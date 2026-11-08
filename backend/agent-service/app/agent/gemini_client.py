import os
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("agent.gemini")

# Đồng bộ 100% với docker-compose.yml và .env.example
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"
# Đơn vị của HttpOptions.timeout trong SDK google-genai là mili giây
GEMINI_TIMEOUT_MS = 30_000
DEFAULT_GEMINI_TEMPERATURE = float(os.getenv("GEMINI_TEMPERATURE", "0.2"))


class GeminiAgentClient:
    """
    Client tương tác với Google Gemini sử dụng SDK chuẩn google-genai.
    Hỗ trợ Function Calling đa tầng, đính kèm System Instruction và timeout 30 giây.
    Đồng bộ model mặc định với docker-compose: gemini-3.5-flash-lite.
    Nhiệt độ (temperature) có thể cấu hình qua biến môi trường GEMINI_TEMPERATURE (mặc định 0.2, benchmark dùng 0.0).
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: Optional[float] = None
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.model_name = model_name or os.getenv("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL
        self.temperature = temperature if temperature is not None else DEFAULT_GEMINI_TEMPERATURE
        self._client = None
        self._init_client()

    def _init_client(self) -> None:
        if not self.api_key:
            logger.warning("[GeminiClient] GEMINI_API_KEY is not configured in environment.")
            return
        try:
            from google import genai
            from google.genai import types

            self._client = genai.Client(
                api_key=self.api_key,
                http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS)
            )
            logger.info(f"[GeminiClient] Initialized Google GenAI Client (model: {self.model_name}, timeout: {GEMINI_TIMEOUT_MS}ms)")
        except Exception as e:
            logger.error(f"[GeminiClient] Failed to initialize google-genai client: {e}")
            self._client = None

    def is_available(self) -> bool:
        return self._client is not None

    def call_react_turn(
        self,
        contents: List[Any],
        tools_declarations: Optional[List[Dict[str, Any]]] = None,
        system_instruction: Optional[str] = None,
        temperature: Optional[float] = None
    ) -> Any:
        """
        Thực hiện một lượt sinh lời giải hoặc gọi function calling từ Gemini.
        Ném Exception nếu gặp sự cố mạng hoặc lỗi upstream để Circuit Breaker ghi nhận.
        """
        if not self.is_available():
            raise ConnectionError("Google GenAI client is not configured or unavailable.")

        try:
            from google.genai import types

            # Cấu hình Function Calling Tools
            genai_tools = []
            if tools_declarations:
                genai_tools = [{"function_declarations": tools_declarations}]

            effective_temp = temperature if temperature is not None else self.temperature

            config = types.GenerateContentConfig(
                temperature=effective_temp,
                system_instruction=system_instruction,
                tools=genai_tools if genai_tools else None
            )

            response = self._client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=config
            )
            return response
        except Exception as e:
            logger.error(f"[GeminiClient] Error calling Gemini API ({self.model_name}): {e}")
            raise


# Singleton instance
gemini_client = GeminiAgentClient()
