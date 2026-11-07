import os
import logging
from typing import Any, Dict, List, Optional
import httpx
from pydantic import ValidationError

from app.mcp.schema import (
    CheckWeatherRiskOutput,
    PesticideItem,
    QueryPesticideStoreOutput
)

logger = logging.getLogger("mcp.client")

# Dùng chung một client: tạo mới mỗi lần phải nạp chứng chỉ TLS (khoảng 280ms) và không tái sử dụng kết nối
_shared_client = httpx.Client()


class CoreApiClient:
    """
    HTTP Client gọi Core API (.NET 8), nguồn dữ liệu duy nhất của thuốc và thời tiết.
    Fail-Closed: Core lỗi, không kết nối được hoặc trả dữ liệu thiếu/sai thì ném ConnectionError,
    không đoán hay tự điền giá trị, để Router ngoại tuyến của TASK-07 chuyển sang phác đồ dự phòng.
    Bộ đệm thời tiết 1 giờ do Core quản lý; Agent không lưu cache trùng lặp.
    """
    def __init__(self, base_url: Optional[str] = None, timeout: float = 5.0):
        self.base_url = (base_url or os.environ.get("CORE_API_URL") or "http://core-api:8080").rstrip("/")
        self.timeout = timeout

    def _get_json(self, path: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Gọi GET tới Core; mọi lỗi mạng, HTTP hoặc JSON đều quy về ConnectionError."""
        url = f"{self.base_url}{path}"
        # Khoá nội bộ để Core không tính lượt của Agent vào giới hạn theo IP
        secret = os.environ.get("INTERNAL_API_SECRET")
        headers = {"X-Internal-Key": secret} if secret else {}
        try:
            resp = _shared_client.get(url, params=params, headers=headers, timeout=self.timeout)
        except httpx.RequestError as e:
            logger.error(f"Connection to Core API failed at {path}: {type(e).__name__}")
            raise ConnectionError(f"Core API is unreachable at {path}") from e

        if resp.status_code != 200:
            logger.error(f"Core API {path} returned HTTP {resp.status_code}")
            raise ConnectionError(f"Core API {path} failed with status {resp.status_code}")

        try:
            data = resp.json()
        except ValueError as e:
            raise ConnectionError(f"Core API {path} returned invalid JSON") from e
        if not isinstance(data, dict):
            raise ConnectionError(f"Core API {path} returned an unexpected payload")
        return data

    def search_medicines(
        self,
        disease_code: str,
        require_rain_resistant: Optional[bool] = None
    ) -> QueryPesticideStoreOutput:
        """
        Gọi GET /api/v1/medicines/search, luôn với allowedOnly=true.
        Thiếu phi_days hoặc is_allowed thì từ chối cả danh sách, không tự coi là an toàn.
        SSOT: api-contracts.md Mục 3.4
        """
        params: Dict[str, Any] = {
            "diseaseCode": disease_code,
            "allowedOnly": "true"
        }
        if require_rain_resistant is not None:
            params["requireRainResistant"] = "true" if require_rain_resistant else "false"

        data = self._get_json("/api/v1/medicines/search", params)

        raw_items = data.get("items")
        if not isinstance(raw_items, list):
            raise ConnectionError("Core API medicines search response has no items list")

        try:
            parsed = [PesticideItem.model_validate(item) for item in raw_items]
        except ValidationError as e:
            logger.error(f"Core API medicines search returned invalid items: {e.error_count()} error(s)")
            raise ConnectionError("Core API medicines search returned invalid items") from e

        # Bảo vệ kép: kể cả Core trả nhầm, thuốc không được cấp phép cũng không tới được LLM
        allowed: List[PesticideItem] = [m for m in parsed if m.is_allowed]
        if len(allowed) != len(parsed):
            logger.warning(f"Discarded {len(parsed) - len(allowed)} unallowed pesticide(s) from Core API response.")

        return QueryPesticideStoreOutput(
            total=len(allowed),
            disease_code=disease_code,
            is_fallback=data.get("is_fallback") is True,
            items=allowed
        )

    def fetch_weather(
        self,
        location: str,
        forecast_hours: int = 12
    ) -> CheckWeatherRiskOutput:
        """
        Gọi GET /api/v1/weather. Thiếu trường nào thì báo lỗi, không tự điền "không mưa".
        SSOT: api-contracts.md Mục 3.9
        """
        data = self._get_json(
            "/api/v1/weather",
            {"location": location, "forecastHours": forecast_hours}
        )

        try:
            return CheckWeatherRiskOutput.model_validate(data)
        except ValidationError as e:
            logger.error(f"Core API weather returned invalid data: {e.error_count()} error(s)")
            raise ConnectionError("Core API weather returned invalid data") from e
