import os
import json
import time
import logging
import threading
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("agent.trace")

MAX_TRACES_IN_MEMORY = 100
DEFAULT_WATERFALL_FILENAME = "trace_waterfall.json"


def clean_payload_for_client(data: Any, max_text_len: int = 300) -> Any:
    """
    Loại bỏ triệt để 'full_text' khỏi citations và kết quả công cụ (SSOT api-contracts.md Mục 4.1).
    Cắt bớt các chuỗi quá dài để tránh phình to payload SSE observation gửi về trình duyệt.
    """
    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            if k == "full_text":
                continue
            cleaned[k] = clean_payload_for_client(v, max_text_len)
        return cleaned
    elif isinstance(data, list):
        return [clean_payload_for_client(item, max_text_len) for item in data]
    elif isinstance(data, str) and len(data) > max_text_len:
        return data[:max_text_len] + "..."
    return data


class TraceLogger:
    """
    Module ghi nhận vết thực thi ReAct (Observability & XAI).
    - Lưu xoay vòng (rotating buffer) tối đa 100 phiên gần nhất trong RAM.
    - Format và xuất file trace_waterfall.json phục vụ biểu đồ tiến trình.
    - Cung cấp dữ liệu cho endpoint GET /api/v1/agent/trace/{trace_id} (SSOT 4.2).
    """
    def __init__(self, max_traces: int = MAX_TRACES_IN_MEMORY):
        self.max_traces = max_traces
        self._traces: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._lock = threading.Lock()

    def log_trace(
        self,
        trace_id: str,
        query: str,
        total_duration_ms: float,
        steps: List[Dict[str, Any]],
        safety_audit: Optional[Dict[str, Any]] = None,
        total_tokens: Optional[int] = None,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Ghi nhận một phiên thực thi hoàn chỉnh vào bộ nhớ xoay vòng và cập nhật file JSON."""
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Ước lượng tokens nếu không có số liệu chính xác từ API
        estimated_tokens = total_tokens
        if estimated_tokens is None:
            # Ước tính sơ bộ: 1 token ~ 3.5 ký tự tiếng Việt
            total_chars = len(query) + sum(len(str(s)) for s in steps)
            estimated_tokens = max(50, int(total_chars / 3.5))

        # Chuẩn hoá danh sách steps cho Waterfall Chart
        waterfall_steps = []
        ssot_steps = []
        for idx, s in enumerate(steps, start=1):
            s_type = s.get("type", "step")
            s_duration = round(float(s.get("duration_ms", 0.0)), 2)

            # Cấu trúc dành cho SSOT 4.2 (GET /api/v1/agent/trace/{id})
            ssot_entry = {
                "step_order": idx,
                "type": s_type,
                "duration_ms": s_duration
            }
            if s.get("thought"):
                ssot_entry["content"] = s["thought"]
            elif s.get("content"):
                ssot_entry["content"] = s["content"]

            if s.get("tool_name"):
                ssot_entry["tool_name"] = s["tool_name"]
            if s.get("tool_input") is not None:
                ssot_entry["tool_input"] = s["tool_input"]
            if s.get("tool_output") is not None:
                ssot_entry["tool_output"] = clean_payload_for_client(s["tool_output"])
            if s.get("guardrail_name"):
                ssot_entry["guardrail_name"] = s["guardrail_name"]
            if s.get("status"):
                ssot_entry["status"] = s["status"]
            if s.get("reason"):
                ssot_entry["reason"] = s["reason"]

            ssot_steps.append(ssot_entry)

            # Cấu trúc pha thời gian (Waterfall Phase)
            phase_name = s.get("phase")
            if not phase_name:
                if s_type == "thought":
                    phase_name = f"Thought_{idx}"
                elif s_type == "action":
                    phase_name = f"Tool_{s.get('tool_name', 'unknown')}"
                elif s_type == "guardrail_check":
                    phase_name = f"Guardrail_{s.get('guardrail_name', 'check')}"
                else:
                    phase_name = f"Phase_{idx}_{s_type}"

            waterfall_steps.append({
                "phase": phase_name,
                "duration_ms": s_duration
            })

        record: Dict[str, Any] = {
            "trace_id": trace_id,
            "conversation_id": conversation_id,
            "timestamp": now_iso,
            "query": query,
            "total_duration_ms": round(total_duration_ms, 2),
            "total_tokens": estimated_tokens,
            "steps": ssot_steps,
            "waterfall_steps": waterfall_steps,
            "safety_audit": safety_audit or {
                "phi_violation_detected": False,
                "chemical_pesticides_blocked": [],
                "allowed_bio_medicines": [],
                "draft_recommendation_applied": True
            }
        }

        with self._lock:
            # Xoay vòng tối đa 100 traces
            if len(self._traces) >= self.max_traces:
                self._traces.popitem(last=False)
            self._traces[trace_id] = record

        # Xuất file trace_waterfall.json phiên gần nhất
        self.export_waterfall_json(record)
        return record

    def get_trace(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """Lấy chi tiết vết thực thi theo trace_id."""
        with self._lock:
            return self._traces.get(trace_id)

    def get_all_traces(self) -> List[Dict[str, Any]]:
        """Lấy danh sách tất cả các trace trong bộ nhớ đệm."""
        with self._lock:
            return list(self._traces.values())

    def export_waterfall_json(self, trace_record: Optional[Dict[str, Any]] = None) -> None:
        """
        Ghi tệp trace_waterfall.json tương thích cấu hình nghiệm thu và prototype DAY3.
        Ghi vào cả thư mục backend/agent-service và thư mục gốc của repo nếu tồn tại.
        """
        record = trace_record
        if not record:
            with self._lock:
                if not self._traces:
                    return
                record = list(self._traces.values())[-1]

        export_data = {
            "trace_id": record["trace_id"],
            "query": record["query"],
            "total_duration_ms": record["total_duration_ms"],
            "steps": record.get("waterfall_steps", []),
            "safety_audit": record.get("safety_audit", {})
        }

        targets = [
            DEFAULT_WATERFALL_FILENAME,
            os.path.join(os.path.dirname(__file__), "..", "..", DEFAULT_WATERFALL_FILENAME)
        ]

        for path in targets:
            try:
                norm_path = os.path.normpath(path)
                with open(norm_path, "w", encoding="utf-8") as f:
                    json.dump(export_data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.warning(f"[TraceLogger] Failed to export waterfall json to {path}: {e}")

    def clear(self) -> None:
        with self._lock:
            self._traces.clear()


# Singleton instance toàn cục
trace_logger = TraceLogger()
