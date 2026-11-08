import os
import re
import time
import uuid
import asyncio
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple
from dataclasses import dataclass, field

from app.agent.prompts import AGRI_AGENT_SYSTEM_PROMPT
from app.agent.memory import stm_memory
from app.agent.guardrails import (
    HARVEST_BEFORE_PHI_VIOLATION,
    PHI_WARNING_TITLE,
    apply_hitl_tag,
    pre_filter_medicines,
    post_filter_response,
    strip_unsourced_dosage
)
from app.agent.resilience import circuit_breaker, offline_router
from app.agent.gemini_client import gemini_client
from app.agent.trace_logger import trace_logger, clean_payload_for_client
from app.mcp.server import mcp_server

logger = logging.getLogger("agent.react")

MAX_TOOLS_PER_TURN = 3
MAX_TOTAL_TOOL_CALLS = 8
STREAM_TOKEN_DELAY_SECONDS = float(os.getenv("STREAM_TOKEN_DELAY_SECONDS", "0.005"))

_HARVEST_WORDS = r"thu hoạch|thu hoach|thu trái|hái|cắt"
_NUMBER_WORDS = {
    "một": 1, "hai": 2, "ba": 3, "bốn": 4, "năm": 5,
    "sáu": 6, "bảy": 7, "tám": 8, "chín": 9, "mười": 10
}
_RELATIVE_DAYS = {
    "hôm nay": 0, "bữa nay": 0, "ngày mai": 1, "mai": 1, "ngày kia": 2,
    "ngày mốt": 2, "mốt": 2, "tuần sau": 7, "tuần tới": 7
}
_NUMBER = r"\d+|" + "|".join(_NUMBER_WORDS)
_GAP = r"[^.,;!?\n]{0,20}?"
_RELATIVE = "|".join(sorted(_RELATIVE_DAYS, key=len, reverse=True))
_HARVEST_PATTERNS = [
    re.compile(rf"(?<!\w)({_NUMBER})\s*(ngày|ngay|tuần|tuan)(?!\w){_GAP}(?<!\w)(?:{_HARVEST_WORDS})(?!\w)", re.IGNORECASE),
    re.compile(rf"(?<!\w)(?:{_HARVEST_WORDS})(?!\w){_GAP}(?<!\w)({_NUMBER})\s*(ngày|ngay|tuần|tuan)(?!\w)", re.IGNORECASE),
]
_HARVEST_RELATIVE_PATTERNS = [
    re.compile(rf"(?<!\w)({_RELATIVE})(?!\w){_GAP}(?<!\w)(?:{_HARVEST_WORDS})(?!\w)", re.IGNORECASE),
    re.compile(rf"(?<!\w)(?:{_HARVEST_WORDS})(?!\w){_GAP}(?<!\w)({_RELATIVE})(?!\w)", re.IGNORECASE),
]


@dataclass
class AgentStep:
    step_order: int
    type: str  # "thought" | "action" | "observation" | "guardrail_check"
    thought: Optional[str] = None
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    tool_output: Optional[Any] = None
    guardrail_name: Optional[str] = None
    status: Optional[str] = None
    reason: Optional[str] = None
    duration_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "step_order": self.step_order,
            "type": self.type,
            "duration_ms": round(self.duration_ms, 2)
        }
        if self.thought:
            data["thought"] = self.thought
        if self.tool_name:
            data["tool_name"] = self.tool_name
        if self.tool_input is not None:
            data["tool_input"] = self.tool_input
        if self.tool_output is not None:
            data["tool_output"] = clean_payload_for_client(self.tool_output)
        if self.guardrail_name:
            data["guardrail_name"] = self.guardrail_name
        if self.status:
            data["status"] = self.status
        if self.reason:
            data["reason"] = self.reason
        return data


@dataclass
class AgentResponse:
    conversation_id: str
    final_answer: str
    steps: List[AgentStep] = field(default_factory=list)
    citations: List[Dict[str, Any]] = field(default_factory=list)
    is_offline_fallback: bool = False
    guardrail_triggered: Optional[str] = None
    latency_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conversation_id": self.conversation_id,
            "final_answer": self.final_answer,
            "steps": [s.to_dict() for s in self.steps],
            # full_text chỉ dành cho LLM suy luận, hợp đồng trả về client dùng excerpt (api-contracts.md Mục 4.1)
            "citations": [
                {key: value for key, value in citation.items() if key != "full_text"}
                for citation in self.citations
            ],
            "guardrail_triggered": self.guardrail_triggered,
            "is_offline_fallback": self.is_offline_fallback,
            "latency_ms": round(self.latency_ms, 2)
        }


def extract_harvest_days_from_text(text: str) -> Optional[int]:
    """
    Trích xuất số ngày đến kỳ thu hoạch từ câu chat của nông dân (ví dụ "2 ngày nữa là thu hoạch",
    "thu hoạch sau hai ngày", "ngày mai hái"). Có nhiều giá trị thì lấy giá trị nhỏ nhất (bảo thủ).
    """
    candidates: List[int] = []
    for pattern in _HARVEST_PATTERNS:
        for number, unit in pattern.findall(text):
            value = int(number) if number.isdigit() else _NUMBER_WORDS[number.lower()]
            candidates.append(value * 7 if unit.lower() in ("tuần", "tuan") else value)
    for pattern in _HARVEST_RELATIVE_PATTERNS:
        candidates.extend(_RELATIVE_DAYS[word.lower()] for word in pattern.findall(text))
    return min(candidates) if candidates else None


class ReActAgent:
    """
    Bộ não suy luận trung tâm của Lavitree AI Agent.
    Vận hành theo chu trình ReAct Loop (Thought -> Action -> Observation -> Final Answer).
    Tích hợp các tầng bảo vệ:
    1. Giới hạn số bước lặp: max_iterations = 5, giới hạn tool calls chống lặp vô hạn.
    2. Chốt chặn Hard Code Guardrail (Pre-filter gỡ bỏ thuốc cấm/vi phạm PHI; Post-filter bóc tách tên thuốc vi phạm).
    3. Bảo toàn thought_signature trong Google GenAI SDK (gộp function_response vào 1 user turn).
    4. Bộ nhớ ngắn hạn STM (Rolling Window K=3 theo conversation_id).
    5. Circuit Breaker & Router tự phục hồi ngoại tuyến (Offline IPM Cache < 500ms).
    """
    def __init__(self, max_iterations: int = 5):
        self.max_iterations = max_iterations

    def run(
        self,
        message: str,
        conversation_id: Optional[str] = None,
        disease_code: Optional[str] = None,
        location: Optional[str] = None,
        harvest_days_left: Optional[int] = None
    ) -> AgentResponse:
        start_time = time.perf_counter()
        conv_id = conversation_id or str(uuid.uuid4())

        # Nguyên tắc bảo thủ: Nếu trong tin nhắn có số ngày thu hoạch nhỏ hơn ô nhập, ưu tiên số nhỏ hơn
        text_harvest_days = extract_harvest_days_from_text(message)
        effective_harvest_days = harvest_days_left
        if text_harvest_days is not None:
            if effective_harvest_days is None or text_harvest_days < effective_harvest_days:
                logger.info(f"[ReActAgent] Detected shorter harvest window in text ({text_harvest_days}d vs {effective_harvest_days}d). Using conservative window.")
                effective_harvest_days = text_harvest_days

        # 1. KIỂM TRA CIRCUIT BREAKER & DỊCH VỤ NGOẠI VI
        # Kiểm tra client trước: can_execute() có thể giữ lượt thăm dò của Circuit Breaker
        if not gemini_client.is_available() or not circuit_breaker.can_execute():
            logger.warning("[ReActAgent] Circuit Breaker is OPEN or Gemini client unavailable. Diverting to Offline Router.")
            return self._offline_response(
                conv_id, message, disease_code, effective_harvest_days, [], start_time,
                "Mất kết nối hoặc dịch vụ AI gặp sự cố. Tự động chuyển phác đồ IPM kiểm định cục bộ."
            )

        steps: List[AgentStep] = []
        try:
            return self._run_react_loop(
                message, conv_id, disease_code, location, effective_harvest_days, steps, start_time
            )
        except Exception as e:
            # Lỗi ngoài dự kiến cũng không được thành HTTP 500 cho nông dân
            logger.exception("[ReActAgent] Unexpected failure in ReAct loop. Diverting to Offline Router.")
            circuit_breaker.record_failure(e)
            return self._offline_response(
                conv_id, message, disease_code, effective_harvest_days, steps, start_time,
                "Trợ lý AI gặp sự cố. Tự động hạ cấp phác đồ IPM cục bộ."
            )

    def _offline_response(
        self,
        conv_id: str,
        message: str,
        disease_code: Optional[str],
        harvest_days: Optional[int],
        steps: List[AgentStep],
        start_time: float,
        reason: str
    ) -> AgentResponse:
        # Chi tiết lỗi chỉ ghi log, không đưa vào reason vì steps được trả về client
        offline_result = offline_router.get_offline_solution(
            disease_code=disease_code,
            harvest_days_left=harvest_days,
            user_query=message
        )
        stm_memory.add_turn(conv_id, message, offline_result["final_answer"])
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        final_steps = steps + [
            AgentStep(
                step_order=len(steps) + 1,
                type="guardrail_check",
                guardrail_name="circuit_breaker_resilience",
                status="DIVERTED_TO_OFFLINE_CACHE",
                reason=reason,
                duration_ms=elapsed_ms
            )
        ]
        trace_logger.log_trace(
            trace_id=f"tr-{uuid.uuid4().hex[:8]}",
            query=message,
            total_duration_ms=elapsed_ms,
            steps=[s.to_dict() for s in final_steps],
            safety_audit={
                "phi_violation_detected": offline_result.get("guardrail_triggered") is not None,
                "chemical_pesticides_blocked": [],
                "allowed_bio_medicines": [],
                "draft_recommendation_applied": "[DRAFT_RECOMMENDATION]" in offline_result["final_answer"]
            },
            conversation_id=conv_id
        )
        return AgentResponse(
            conversation_id=conv_id,
            final_answer=offline_result["final_answer"],
            steps=final_steps,
            citations=offline_result.get("citations", []),
            is_offline_fallback=True,
            guardrail_triggered=offline_result.get("guardrail_triggered"),
            latency_ms=elapsed_ms
        )

    def _run_react_loop(
        self,
        message: str,
        conv_id: str,
        disease_code: Optional[str],
        location: Optional[str],
        effective_harvest_days: Optional[int],
        steps: List[AgentStep],
        start_time: float
    ) -> AgentResponse:
        collected_citations: Dict[str, Dict[str, Any]] = {}
        had_phi_violation = False
        total_tool_calls_count = 0

        # 2. CHUẨN BỊ NGỮ CẢNH HỘI THOẠI & PROMPT
        history = stm_memory.get_history(conv_id)
        tools_decl = mcp_server.to_gemini_declarations()

        context_lines = [
            f"BỐI CẢNH CA BỆNH:",
            f"- Câu hỏi của Nông dân: '{message}'",
        ]
        if disease_code:
            context_lines.append(f"- Mã bệnh chẩn đoán: {disease_code}")
        if location:
            context_lines.append(f"- Vị trí địa lý vườn cây: {location}")
        if effective_harvest_days is not None:
            context_lines.append(f"- Số ngày dự kiến đến kỳ thu hoạch: {effective_harvest_days} ngày")
        else:
            context_lines.append(f"- Số ngày thu hoạch: Không rõ (BẮT BUỘC COI NHƯ SẮP THU HOẠCH - KHÔNG DÙNG THUỐC HÓA HỌC)")

        context_prompt = "\n".join(context_lines)

        contents: List[Any] = []
        for turn in history:
            # Gemini chỉ nhận role "user" và "model"
            role = "model" if turn["role"] == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": turn["content"]}]})
        contents.append({"role": "user", "parts": [{"text": f"{context_prompt}\n\nVui lòng suy luận cẩn thận và gọi công cụ kiểm tra thông tin trước khi đưa ra phác đồ điều trị."}]})

        # 3. VÒNG LẶP REACT LOOP (TỐI ĐA 5 BƯỚC)
        final_answer_text = ""
        current_iteration = 0
        observed_weather_info: Optional[Dict[str, Any]] = None
        store_checked = False
        allowed_medicines: List[Dict[str, Any]] = []
        blocked_medicines: List[Dict[str, Any]] = []

        while current_iteration < self.max_iterations:
            current_iteration += 1
            call_start = time.perf_counter()

            try:
                response = gemini_client.call_react_turn(
                    contents=contents,
                    tools_declarations=tools_decl,
                    system_instruction=AGRI_AGENT_SYSTEM_PROMPT
                )
            except Exception as e:
                logger.error(f"[ReActAgent] Upstream Gemini call failed during ReAct turn: {e}")
                circuit_breaker.record_failure(e)
                # Tự động hạ cấp sang Offline IPM Cache ngay lập tức
                return self._offline_response(
                    conv_id, message, disease_code, effective_harvest_days, steps, start_time,
                    "Lỗi kết nối AI upstream. Tự động hạ cấp phác đồ IPM cục bộ."
                )

            call_duration = (time.perf_counter() - call_start) * 1000.0

            candidates = getattr(response, "candidates", None) or []
            if not candidates or not candidates[0].content or not getattr(candidates[0].content, "parts", None):
                logger.warning("[ReActAgent] Empty candidate content received from Gemini.")
                if not steps:
                    # Gemini vẫn phản hồi (không phải sự cố hạ tầng) nhưng chưa có thông tin gì để tổng hợp
                    circuit_breaker.record_success()
                    return self._offline_response(
                        conv_id, message, disease_code, effective_harvest_days, steps, start_time,
                        "Trợ lý AI không trả về nội dung. Tự động hạ cấp phác đồ IPM cục bộ."
                    )
                break

            candidate_content = candidates[0].content
            function_calls = []
            text_parts = []

            for part in candidate_content.parts:
                if getattr(part, "function_call", None):
                    function_calls.append(part.function_call)
                elif getattr(part, "text", None):
                    text_parts.append(part.text)

            # Trường hợp 1: Gemini yêu cầu gọi công cụ (Action)
            if function_calls:
                # BẢO TOÀN THOUGHT SIGNATURE: Thêm nguyên vẹn candidate_content vào contents
                contents.append(candidate_content)

                steps.append(AgentStep(
                    step_order=len(steps) + 1,
                    type="thought",
                    thought="".join(text_parts).strip() if text_parts else "Cần gọi công cụ để tra cứu thông tin chính xác.",
                    duration_ms=call_duration
                ))

                function_responses_parts: List[Dict[str, Any]] = []

                for call_index, fc in enumerate(function_calls):
                    fn_name = fc.name
                    fn_args = dict(fc.args) if fc.args else {}

                    # Gemini yêu cầu mỗi function_call có đúng một function_response, kể cả lệnh bị từ chối
                    if call_index >= MAX_TOOLS_PER_TURN or total_tool_calls_count >= MAX_TOTAL_TOOL_CALLS:
                        logger.warning(f"[ReActAgent] Tool call limit reached. Skipping '{fn_name}'.")
                        function_responses_parts.append({
                            "function_response": {
                                "name": fn_name,
                                "response": {"result": {"error": "Đã vượt giới hạn gọi công cụ. Hãy tổng hợp câu trả lời từ thông tin đã có."}}
                            }
                        })
                        continue

                    total_tool_calls_count += 1

                    steps.append(AgentStep(
                        step_order=len(steps) + 1,
                        type="action",
                        tool_name=fn_name,
                        tool_input=fn_args,
                        duration_ms=call_duration
                    ))

                    # Thực thi tool qua MCP Server
                    tool_start = time.perf_counter()
                    tool_resp = mcp_server.call_tool(fn_name, fn_args)
                    tool_duration = (time.perf_counter() - tool_start) * 1000.0

                    # KIỂM SOÁT SỰ CỐ CORE API / MCP UPSTREAM
                    if tool_resp.is_error:
                        logger.error(f"[ReActAgent] Tool '{fn_name}' returned error: {tool_resp.error_code} - {tool_resp.error_message}")
                        if tool_resp.error_code in ["UPSTREAM_UNAVAILABLE", "INTERNAL"]:
                            circuit_breaker.record_failure(ConnectionError(f"Tool {fn_name} failed: {tool_resp.error_message}"))
                            # Với các công cụ thiết yếu, chuyển ngay sang offline phác đồ IPM kiểm định
                            if fn_name in ["query_pesticide_store", "check_weather_risk", "lookup_disease_knowledge"]:
                                logger.warning(f"[ReActAgent] Critical tool '{fn_name}' failed upstream. Diverting to offline IPM cache.")
                                return self._offline_response(
                                    conv_id, message, disease_code, effective_harvest_days, steps, start_time,
                                    f"Công cụ '{fn_name}' không khả dụng. Hạ cấp phác đồ IPM."
                                )

                    tool_data = tool_resp.result if not tool_resp.is_error else {"error": tool_resp.error_message}

                    # CHỐT CHẶN TIỀN LỌC (HARD PRE-FILTER GUARDRAIL)
                    if fn_name == "query_pesticide_store" and not tool_resp.is_error and isinstance(tool_data, dict):
                        raw_items = tool_data.get("items", [])
                        filtered_items, violated, blocked_reasons = pre_filter_medicines(raw_items, effective_harvest_days)
                        blocked_items = [item for item in raw_items if item not in filtered_items]
                        if violated:
                            had_phi_violation = True

                        tool_data["items"] = filtered_items
                        tool_data["total"] = len(filtered_items)
                        store_checked = True
                        allowed_medicines.extend(filtered_items)
                        blocked_medicines.extend(blocked_items)

                        steps.append(AgentStep(
                            step_order=len(steps) + 1,
                            type="guardrail_check",
                            guardrail_name="verify_phi_safety",
                            status="BLOCKED_CHEMICAL_PESTICIDE" if blocked_items else "PERMITTED",
                            reason="; ".join(blocked_reasons) if blocked_reasons else "Tất cả thuốc trả về đều đáp ứng an toàn PHI.",
                            duration_ms=round(tool_duration, 2)
                        ))

                    elif fn_name == "check_weather_risk" and not tool_resp.is_error and isinstance(tool_data, dict):
                        observed_weather_info = tool_data

                    elif fn_name == "lookup_disease_knowledge" and not tool_resp.is_error and isinstance(tool_data, dict):
                        for citation in tool_data.get("citations", []):
                            collected_citations[citation["source_id"]] = citation

                    # Ghi nhận bước Observation
                    steps.append(AgentStep(
                        step_order=len(steps) + 1,
                        type="observation",
                        tool_name=fn_name,
                        tool_output=tool_data,
                        duration_ms=round(tool_duration, 2)
                    ))

                    # Thêm function_response vào danh sách parts
                    function_responses_parts.append({
                        "function_response": {
                            "name": fn_name,
                            "response": {"result": tool_data}
                        }
                    })

                # GỘP TẤT CẢ FUNCTION RESPONSES VÀO 1 LƯỢT CỦA USER
                contents.append({
                    "role": "user",
                    "parts": function_responses_parts
                })

            # Trường hợp 2: Gemini trả về văn bản kết luận cuối cùng (Final Answer)
            elif text_parts:
                # Các part là những đoạn liên tiếp của một văn bản, có thể bị cắt ngay giữa từ
                final_answer_text = "".join(text_parts).strip()
                break

            else:
                logger.warning("[ReActAgent] Gemini returned parts without text or function call. Stopping loop.")
                break

        # 4. HẬU KIỂM VÀ TỔNG HỢP CÂU TRẢ LỜI
        if not final_answer_text:
            # Hết 5 vòng: Tổng hợp từ các quan sát đã thu thập và khuyến nghị tham vấn chuyên gia
            summary_lines = [
                f"Lavi chưa kết luận được đầy đủ cho ca bệnh ({disease_code or 'cây trồng'}). Thông tin đã kiểm tra:"
            ]
            if observed_weather_info:
                loc = observed_weather_info.get("location", location or "")
                rain_status = "có mưa/ẩm ướt" if observed_weather_info.get("is_rain") else "khô ráo"
                summary_lines.append(f"- Điều kiện thời tiết tại {loc}: {rain_status} (Rủi ro rửa trôi: {observed_weather_info.get('risk_level', 'LOW')}).")

            if allowed_medicines:
                med_names = sorted({str(m.get("name") or m.get("product_name")) for m in allowed_medicines})
                summary_lines.append(f"- Thuốc trong kho đáp ứng điều kiện cách ly: {', '.join(med_names)}.")
            elif store_checked:
                summary_lines.append("- Kho Lavitree không có thuốc nào đáp ứng thời gian cách ly PHI.")
            else:
                summary_lines.append("- Chưa kiểm tra được kho thuốc nên Lavi chưa nêu thuốc cụ thể.")

            summary_lines.append("Bạn nên ưu tiên biện pháp canh tác, vệ sinh vườn và tham vấn Kỹ sư nông nghiệp trước khi dùng thuốc.")
            final_answer_text = "\n".join(summary_lines)

        # Chốt chặn hậu kiểm: Bóc tách triệt để tên thuốc hóa học nếu vi phạm PHI
        final_answer_text = post_filter_response(
            final_answer_text,
            harvest_days_left=effective_harvest_days,
            had_phi_violation=had_phi_violation,
            blocked_medicines=blocked_medicines,
            allowed_medicines=allowed_medicines
        )

        # Liều lượng phải có trong tài liệu đã tra, kho thuốc đã lọc hoặc câu trả lời đã qua kiểm ở lượt trước
        evidence_texts = [str(citation.get("full_text", "")) for citation in collected_citations.values()]
        evidence_texts += [
            f"{med.get('dosage_instruction', '')} {med.get('active_ingredient', '')}" for med in allowed_medicines
        ]
        evidence_texts += [turn["content"] for turn in history if turn["role"] == "assistant"]
        final_answer_text = strip_unsourced_dosage(final_answer_text, evidence_texts)

        # Gắn nhãn HITL bắt buộc [DRAFT_RECOMMENDATION]
        final_answer_text = apply_hitl_tag(final_answer_text)

        # Lưu lượt hội thoại mới vào bộ nhớ ngắn hạn STM
        stm_memory.add_turn(conv_id, message, final_answer_text)

        # Ghi nhận thành công sau cả lượt: Gemini sống nhưng Core sập vẫn phải làm Circuit Breaker mở
        circuit_breaker.record_success()

        elapsed_total = (time.perf_counter() - start_time) * 1000.0
        phi_detected = (PHI_WARNING_TITLE in final_answer_text) or had_phi_violation

        trace_logger.log_trace(
            trace_id=f"tr-{uuid.uuid4().hex[:8]}",
            query=message,
            total_duration_ms=elapsed_total,
            steps=[s.to_dict() for s in steps],
            safety_audit={
                "phi_violation_detected": phi_detected,
                "chemical_pesticides_blocked": [
                    str(m.get("name") or m.get("product_name")) for m in blocked_medicines
                ],
                "allowed_bio_medicines": [
                    str(m.get("name") or m.get("product_name")) for m in allowed_medicines
                ],
                "draft_recommendation_applied": "[DRAFT_RECOMMENDATION]" in final_answer_text
            },
            conversation_id=conv_id
        )

        return AgentResponse(
            conversation_id=conv_id,
            final_answer=final_answer_text,
            steps=steps,
            citations=list(collected_citations.values()),
            is_offline_fallback=False,
            guardrail_triggered=HARVEST_BEFORE_PHI_VIOLATION if phi_detected else None,
            latency_ms=elapsed_total
        )

    async def run_stream(
        self,
        message: str,
        conversation_id: Optional[str] = None,
        disease_code: Optional[str] = None,
        location: Optional[str] = None,
        harvest_days_left: Optional[int] = None,
        user_id: Optional[str] = None,
        temperature: Optional[float] = None
    ) -> AsyncGenerator[Tuple[str, Dict[str, Any]], None]:
        """
        Thực thi chu trình ReAct Loop với cơ chế Streaming SSE chuẩn SSOT Mục 4.1.
        Phát từng sự kiện trace_start, thought, action, observation thời gian thực.
        Token văn bản 'delta' chỉ được phát SAU KHI toàn bộ câu trả lời đã qua các chốt chặn hậu kiểm.
        """
        start_time = time.perf_counter()
        conv_id = conversation_id or f"conv-{uuid.uuid4().hex[:8]}"
        trace_id = f"tr-{uuid.uuid4().hex[:8]}"

        # 1. Event trace_start
        yield ("trace_start", {
            "trace_id": trace_id,
            "conversation_id": conv_id,
            "status": "thinking"
        })

        # Nguyên tắc bảo thủ ngày thu hoạch
        text_harvest_days = extract_harvest_days_from_text(message)
        effective_harvest_days = harvest_days_left
        if text_harvest_days is not None:
            if effective_harvest_days is None or text_harvest_days < effective_harvest_days:
                logger.info(f"[ReActAgent] Detected shorter harvest window in text ({text_harvest_days}d vs {effective_harvest_days}d). Using conservative window.")
                effective_harvest_days = text_harvest_days

        # Nếu người dùng không nhập số ngày thu hoạch -> mặc định 0 ngày để bảo vệ an toàn tối đa
        if effective_harvest_days is None:
            effective_harvest_days = 0

        # Kiểm tra Circuit Breaker & Gemini
        if not gemini_client.is_available() or not circuit_breaker.can_execute():
            logger.warning("[ReActAgent] Circuit Breaker is OPEN or Gemini client unavailable. Streaming offline fallback.")
            yield ("thought", {
                "step": 1,
                "thought": "Mất kết nối hoặc dịch vụ AI gặp sự cố. Tự động chuyển sang phác đồ IPM kiểm định lưu sẵn."
            })
            offline_result = offline_router.get_offline_solution(
                disease_code=disease_code,
                harvest_days_left=effective_harvest_days,
                user_query=message
            )
            final_ans = offline_result["final_answer"]
            citations = [clean_payload_for_client(c) for c in offline_result.get("citations", [])]

            # Stream delta tokens
            tokens = re.findall(r"\S+\s*|\s+", final_ans)
            for tok in tokens:
                yield ("delta", {"token": tok})
                if STREAM_TOKEN_DELAY_SECONDS > 0:
                    await asyncio.sleep(STREAM_TOKEN_DELAY_SECONDS)

            total_ms = int((time.perf_counter() - start_time) * 1000)
            yield ("final_answer", {
                "trace_id": trace_id,
                "answer": final_ans,
                "draft_order": None,
                "guardrail_triggered": offline_result.get("guardrail_triggered"),
                "is_offline_fallback": True,
                "citations": citations,
                "total_latency_ms": total_ms
            })

            stm_memory.add_turn(conv_id, message, final_ans, owner_id=user_id)
            trace_logger.log_trace(
                trace_id=trace_id,
                query=message,
                total_duration_ms=total_ms,
                steps=[{
                    "type": "thought",
                    "thought": "Mất kết nối hoặc dịch vụ AI gặp sự cố. Kích hoạt phác đồ offline.",
                    "duration_ms": total_ms
                }],
                safety_audit={
                    "phi_violation_detected": offline_result.get("guardrail_triggered") is not None,
                    "chemical_pesticides_blocked": [],
                    "allowed_bio_medicines": [],
                    "draft_recommendation_applied": "[DRAFT_RECOMMENDATION]" in final_ans
                },
                conversation_id=conv_id
            )
            return

        # 2. CHUẨN BỊ NGỮ CẢNH HỘI THOẠI
        history = stm_memory.get_history(conv_id)
        tools_decl = mcp_server.to_gemini_declarations()

        context_lines = [
            f"BỐI CẢNH CA BỆNH:",
            f"- Câu hỏi của Nông dân: '{message}'",
        ]
        if disease_code:
            context_lines.append(f"- Mã bệnh chẩn đoán: {disease_code}")
        if location:
            context_lines.append(f"- Vị trí địa lý vườn cây: {location}")
        if effective_harvest_days is not None:
            context_lines.append(f"- Số ngày dự kiến đến kỳ thu hoạch: {effective_harvest_days} ngày")
        else:
            context_lines.append(f"- Số ngày thu hoạch: Không rõ (BẮT BUỘC COI NHƯ SẮP THU HOẠCH - KHÔNG DÙNG THUỐC HÓA HỌC)")

        context_prompt = "\n".join(context_lines)

        contents: List[Any] = []
        for turn in history:
            role = "model" if turn["role"] == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": turn["content"]}]})
        contents.append({"role": "user", "parts": [{"text": f"{context_prompt}\n\nVui lòng suy luận cẩn thận và gọi công cụ kiểm tra thông tin trước khi đưa ra phác đồ điều trị."}]})

        # 3. VÒNG LẶP STREAMING REACT LOOP
        stream_steps: List[Dict[str, Any]] = []
        collected_citations: Dict[str, Dict[str, Any]] = {}
        had_phi_violation = False
        total_tool_calls_count = 0
        final_answer_text = ""
        current_iteration = 0
        observed_weather_info: Optional[Dict[str, Any]] = None
        store_checked = False
        allowed_medicines: List[Dict[str, Any]] = []
        blocked_medicines: List[Dict[str, Any]] = []

        while current_iteration < self.max_iterations:
            current_iteration += 1
            call_start = time.perf_counter()

            try:
                response = await asyncio.to_thread(
                    gemini_client.call_react_turn,
                    contents=contents,
                    tools_declarations=tools_decl,
                    system_instruction=AGRI_AGENT_SYSTEM_PROMPT,
                    temperature=temperature
                )
            except Exception as e:
                logger.error(f"[ReActAgent] Upstream Gemini call failed during ReAct turn: {e}")
                circuit_breaker.record_failure(e)
                # Hạ cấp sang offline fallback
                yield ("thought", {
                    "step": current_iteration,
                    "thought": "Lỗi kết nối AI upstream. Tự động chuyển sang phác đồ IPM kiểm định lưu sẵn."
                })
                offline_result = offline_router.get_offline_solution(
                    disease_code=disease_code,
                    harvest_days_left=effective_harvest_days,
                    user_query=message
                )
                final_ans = offline_result["final_answer"]
                citations = [clean_payload_for_client(c) for c in offline_result.get("citations", [])]

                tokens = re.findall(r"\S+\s*|\s+", final_ans)
                for tok in tokens:
                    yield ("delta", {"token": tok})
                    if STREAM_TOKEN_DELAY_SECONDS > 0:
                        await asyncio.sleep(STREAM_TOKEN_DELAY_SECONDS)

                total_ms = int((time.perf_counter() - start_time) * 1000)
                yield ("final_answer", {
                    "trace_id": trace_id,
                    "answer": final_ans,
                    "draft_order": None,
                    "guardrail_triggered": offline_result.get("guardrail_triggered"),
                    "is_offline_fallback": True,
                    "citations": citations,
                    "total_latency_ms": total_ms
                })
                stm_memory.add_turn(conv_id, message, final_ans, owner_id=user_id)
                trace_logger.log_trace(
                    trace_id=trace_id,
                    query=message,
                    total_duration_ms=total_ms,
                    steps=stream_steps,
                    safety_audit={
                        "phi_violation_detected": offline_result.get("guardrail_triggered") is not None,
                        "chemical_pesticides_blocked": [],
                        "allowed_bio_medicines": [],
                        "draft_recommendation_applied": "[DRAFT_RECOMMENDATION]" in final_ans
                    },
                    conversation_id=conv_id
                )
                return

            call_duration = (time.perf_counter() - call_start) * 1000.0

            candidates = getattr(response, "candidates", None) or []
            if not candidates or not candidates[0].content or not getattr(candidates[0].content, "parts", None):
                logger.warning("[ReActAgent] Empty candidate content received from Gemini.")
                break

            candidate_content = candidates[0].content
            function_calls = []
            text_parts = []

            for part in candidate_content.parts:
                if getattr(part, "function_call", None):
                    function_calls.append(part.function_call)
                elif getattr(part, "text", None):
                    text_parts.append(part.text)

            # Trường hợp 1: Gemini gọi công cụ
            if function_calls:
                contents.append(candidate_content)
                thought_text = "".join(text_parts).strip() if text_parts else "Cần gọi công cụ để tra cứu thông tin chính xác."

                stream_steps.append({
                    "type": "thought",
                    "thought": thought_text,
                    "duration_ms": round(call_duration, 2)
                })
                yield ("thought", {
                    "step": current_iteration,
                    "thought": thought_text
                })

                function_responses_parts: List[Dict[str, Any]] = []

                for call_index, fc in enumerate(function_calls):
                    fn_name = fc.name
                    fn_args = dict(fc.args) if fc.args else {}

                    if call_index >= MAX_TOOLS_PER_TURN or total_tool_calls_count >= MAX_TOTAL_TOOL_CALLS:
                        logger.warning(f"[ReActAgent] Tool call limit reached. Skipping '{fn_name}'.")
                        function_responses_parts.append({
                            "function_response": {
                                "name": fn_name,
                                "response": {"result": {"error": "Đã vượt giới hạn gọi công cụ. Hãy tổng hợp câu trả lời từ thông tin đã có."}}
                            }
                        })
                        continue

                    total_tool_calls_count += 1

                    yield ("action", {
                        "step": current_iteration,
                        "tool": fn_name,
                        "params": fn_args
                    })
                    stream_steps.append({
                        "type": "action",
                        "tool_name": fn_name,
                        "tool_input": fn_args,
                        "duration_ms": 0.0
                    })

                    tool_start = time.perf_counter()
                    tool_resp = await asyncio.to_thread(mcp_server.call_tool, fn_name, fn_args)
                    tool_duration = (time.perf_counter() - tool_start) * 1000.0

                    if tool_resp.is_error:
                        logger.error(f"[ReActAgent] Tool '{fn_name}' returned error: {tool_resp.error_code} - {tool_resp.error_message}")
                        if tool_resp.error_code in ["UPSTREAM_UNAVAILABLE", "INTERNAL"]:
                            circuit_breaker.record_failure(ConnectionError(f"Tool {fn_name} failed: {tool_resp.error_message}"))
                            if fn_name in ["query_pesticide_store", "check_weather_risk", "lookup_disease_knowledge"]:
                                logger.warning(f"[ReActAgent] Critical tool '{fn_name}' failed upstream. Diverting to offline IPM cache.")
                                yield ("thought", {
                                    "step": current_iteration,
                                    "thought": f"Công cụ '{fn_name}' gặp sự cố. Chuyển sang phác đồ IPM kiểm định."
                                })
                                offline_result = offline_router.get_offline_solution(
                                    disease_code=disease_code,
                                    harvest_days_left=effective_harvest_days,
                                    user_query=message
                                )
                                final_ans = offline_result["final_answer"]
                                citations = [clean_payload_for_client(c) for c in offline_result.get("citations", [])]

                                tokens = re.findall(r"\S+\s*|\s+", final_ans)
                                for tok in tokens:
                                    yield ("delta", {"token": tok})
                                    if STREAM_TOKEN_DELAY_SECONDS > 0:
                                        await asyncio.sleep(STREAM_TOKEN_DELAY_SECONDS)

                                total_ms = int((time.perf_counter() - start_time) * 1000)
                                yield ("final_answer", {
                                    "trace_id": trace_id,
                                    "answer": final_ans,
                                    "draft_order": None,
                                    "guardrail_triggered": offline_result.get("guardrail_triggered"),
                                    "is_offline_fallback": True,
                                    "citations": citations,
                                    "total_latency_ms": total_ms
                                })
                                stm_memory.add_turn(conv_id, message, final_ans, owner_id=user_id)
                                trace_logger.log_trace(
                                    trace_id=trace_id,
                                    query=message,
                                    total_duration_ms=total_ms,
                                    steps=stream_steps,
                                    safety_audit={
                                        "phi_violation_detected": offline_result.get("guardrail_triggered") is not None,
                                        "chemical_pesticides_blocked": [],
                                        "allowed_bio_medicines": [],
                                        "draft_recommendation_applied": "[DRAFT_RECOMMENDATION]" in final_ans
                                    },
                                    conversation_id=conv_id
                                )
                                return

                    tool_data = tool_resp.result if not tool_resp.is_error else {"error": tool_resp.error_message}

                    # CHỐT CHẶN TIỀN LỌC (PRE-FILTER GUARDRAIL)
                    if fn_name == "query_pesticide_store" and not tool_resp.is_error and isinstance(tool_data, dict):
                        raw_items = tool_data.get("items", [])
                        filtered_items, violated, blocked_reasons = pre_filter_medicines(raw_items, effective_harvest_days)
                        blocked_items = [item for item in raw_items if item not in filtered_items]
                        if violated:
                            had_phi_violation = True

                        tool_data["items"] = filtered_items
                        tool_data["total"] = len(filtered_items)
                        store_checked = True
                        allowed_medicines.extend(filtered_items)
                        blocked_medicines.extend(blocked_items)

                        stream_steps.append({
                            "type": "guardrail_check",
                            "guardrail_name": "verify_phi_safety",
                            "status": "BLOCKED_CHEMICAL_PESTICIDE" if blocked_items else "PERMITTED",
                            "reason": "; ".join(blocked_reasons) if blocked_reasons else "Tất cả thuốc trả về đều đáp ứng an toàn PHI.",
                            "duration_ms": round(tool_duration, 2)
                        })

                    elif fn_name == "check_weather_risk" and not tool_resp.is_error and isinstance(tool_data, dict):
                        observed_weather_info = tool_data

                    elif fn_name == "lookup_disease_knowledge" and not tool_resp.is_error and isinstance(tool_data, dict):
                        for citation in tool_data.get("citations", []):
                            collected_citations[citation["source_id"]] = citation

                    # Cắt sạch full_text khỏi observation gửi ra client
                    clean_obs = clean_payload_for_client(tool_data)
                    yield ("observation", {
                        "step": current_iteration,
                        "result": clean_obs
                    })
                    stream_steps.append({
                        "type": "observation",
                        "tool_name": fn_name,
                        "tool_output": clean_obs,
                        "duration_ms": round(tool_duration, 2)
                    })

                    function_responses_parts.append({
                        "function_response": {
                            "name": fn_name,
                            "response": {"result": tool_data}
                        }
                    })

                contents.append({
                    "role": "user",
                    "parts": function_responses_parts
                })

            # Trường hợp 2: Gemini trả về Final Answer
            elif text_parts:
                final_answer_text = "".join(text_parts).strip()
                break
            else:
                break

        # 4. HẬU KIỂM VÀ TỔNG HỢP CÂU TRẢ LỜI
        if not final_answer_text:
            summary_lines = [
                f"Lavi chưa kết luận được đầy đủ cho ca bệnh ({disease_code or 'cây trồng'}). Thông tin đã kiểm tra:"
            ]
            if observed_weather_info:
                loc = observed_weather_info.get("location", location or "")
                rain_status = "có mưa/ẩm ướt" if observed_weather_info.get("is_rain") else "khô ráo"
                summary_lines.append(f"- Điều kiện thời tiết tại {loc}: {rain_status} (Rủi ro rửa trôi: {observed_weather_info.get('risk_level', 'LOW')}).")

            if allowed_medicines:
                med_names = sorted({str(m.get("name") or m.get("product_name")) for m in allowed_medicines})
                summary_lines.append(f"- Thuốc trong kho đáp ứng điều kiện cách ly: {', '.join(med_names)}.")
            elif store_checked:
                summary_lines.append("- Kho Lavitree không có thuốc nào đáp ứng thời gian cách ly PHI.")
            else:
                summary_lines.append("- Chưa kiểm tra được kho thuốc nên Lavi chưa nêu thuốc cụ thể.")

            summary_lines.append("Bạn nên ưu tiên biện pháp canh tác, vệ sinh vườn và tham vấn Kỹ sư nông nghiệp trước khi dùng thuốc.")
            final_answer_text = "\n".join(summary_lines)

        # Chốt chặn hậu kiểm: Bóc tách triệt để tên thuốc hóa học nếu vi phạm PHI
        final_answer_text = post_filter_response(
            final_answer_text,
            harvest_days_left=effective_harvest_days,
            had_phi_violation=had_phi_violation,
            blocked_medicines=blocked_medicines,
            allowed_medicines=allowed_medicines
        )

        evidence_texts = [str(citation.get("full_text", "")) for citation in collected_citations.values()]
        evidence_texts += [
            f"{med.get('dosage_instruction', '')} {med.get('active_ingredient', '')}" for med in allowed_medicines
        ]
        evidence_texts += [turn["content"] for turn in history if turn["role"] == "assistant"]
        final_answer_text = strip_unsourced_dosage(final_answer_text, evidence_texts)

        # Gắn nhãn HITL bắt buộc [DRAFT_RECOMMENDATION]
        final_answer_text = apply_hitl_tag(final_answer_text)

        # 5. STREAM TỪNG TOKEN DELTA CỦA CÂU TRẢ LỜI ĐÃ QUA HẬU KIỂM
        # Phân tách từ ngữ và khoảng trắng mượt mà
        delta_tokens = re.findall(r"\S+\s*|\s+", final_answer_text)
        for tok in delta_tokens:
            yield ("delta", {"token": tok})
            if STREAM_TOKEN_DELAY_SECONDS > 0:
                await asyncio.sleep(STREAM_TOKEN_DELAY_SECONDS)

        # 6. Event final_answer
        clean_citations = [
            clean_payload_for_client({k: v for k, v in citation.items() if k != "full_text"})
            for citation in collected_citations.values()
        ]
        elapsed_total = (time.perf_counter() - start_time) * 1000.0
        phi_detected = (PHI_WARNING_TITLE in final_answer_text) or had_phi_violation

        yield ("final_answer", {
            "trace_id": trace_id,
            "answer": final_answer_text,
            "draft_order": None,
            "guardrail_triggered": HARVEST_BEFORE_PHI_VIOLATION if phi_detected else None,
            "is_offline_fallback": False,
            "citations": clean_citations,
            "total_latency_ms": int(elapsed_total)
        })

        # Lưu lượt hội thoại mới vào bộ nhớ STM
        stm_memory.add_turn(conv_id, message, final_answer_text, owner_id=user_id)
        circuit_breaker.record_success()

        # Ghi nhận vết thực thi hoàn chỉnh
        trace_logger.log_trace(
            trace_id=trace_id,
            query=message,
            total_duration_ms=elapsed_total,
            steps=stream_steps,
            safety_audit={
                "phi_violation_detected": phi_detected,
                "chemical_pesticides_blocked": [
                    str(m.get("name") or m.get("product_name")) for m in blocked_medicines
                ],
                "allowed_bio_medicines": [
                    str(m.get("name") or m.get("product_name")) for m in allowed_medicines
                ],
                "draft_recommendation_applied": "[DRAFT_RECOMMENDATION]" in final_answer_text
            },
            conversation_id=conv_id
        )



# Singleton instance toàn cục của ReAct Agent
react_agent = ReActAgent(max_iterations=5)
