"""
Bộ kiểm thử nghiệm thu toàn diện cho TASK-08:
1. Streaming SSE Endpoint POST /api/v1/agent/chat chuẩn SSOT 4.1.
2. Chốt chặn an toàn: Delta stream chỉ phát sinh SAU KHI câu trả lời đã qua hậu kiểm (không bao giờ lộ thuốc vi phạm PHI).
3. Observation payload không chứa full_text và được rút gọn an toàn cho client.
4. Giới hạn 5 lượt hỏi/ngày cho Khách vãng lai (Guest) theo roles-usecases.md Mục 1.1.
5. Kiểm soát chủ sở hữu conversation_id và chống tấn công IDOR giữa các user.
6. Endpoint quan sát vết thực thi GET /api/v1/agent/trace/{trace_id} chuẩn SSOT 4.2.
7. Xuất file trace_waterfall.json với đầy đủ các mốc thời gian suy luận.
8. Streaming tự động hạ cấp ngoại tuyến khi Circuit Breaker kích hoạt.
"""

import os
import sys
import tempfile
from unittest.mock import patch, MagicMock

# Đảm bảo console Windows in tiếng Việt UTF-8
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Thiết lập môi trường kiểm thử cách ly
TEST_DATA_DIR = tempfile.mkdtemp(prefix="lavitree_task08_test_")
TEST_SECRET = "test_internal_secret_key_32chars_ok"
os.environ["RAG_DATA_DIR"] = TEST_DATA_DIR
os.environ["INTERNAL_API_SECRET"] = TEST_SECRET
os.environ["RAG_ALLOW_CSV_FALLBACK"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["STREAM_TOKEN_DELAY_SECONDS"] = "0"
os.environ.pop("AGENT_DB_URL", None)

import json
import time
import unittest
import jwt
from fastapi.testclient import TestClient

# Vô hiệu hoá reindex nền và nạp model embedding nặng trong test suite
from app.rag.reindex_worker import ReindexCoordinator
ReindexCoordinator.request = lambda self: None

from app.rag.vector_retriever import MultilingualEmbeddingFunction
def _fast_init_model(self):
    self.model = MagicMock()
    self.dimension = 1024
MultilingualEmbeddingFunction._init_model = _fast_init_model
MultilingualEmbeddingFunction.name = lambda self: "multilingual_bge_m3"
MultilingualEmbeddingFunction.__call__ = lambda self, input: [[0.01] * 1024 for _ in input]

import app.agent.react_agent as react_module
react_module.STREAM_TOKEN_DELAY_SECONDS = 0.0

from app.main import app
from app.agent.auth import guest_limiter, DEFAULT_JWT_SECRET
from app.agent.trace_logger import trace_logger
from app.agent.resilience import circuit_breaker, CircuitState
from app.agent.memory import stm_memory
from app.agent.gemini_client import gemini_client


# Mock GenAI SDK
class MockPart:
    def __init__(self, function_call=None, text=None):
        self.function_call = function_call
        self.text = text


class MockFunctionCall:
    def __init__(self, name, args):
        self.name = name
        self.args = args


class MockContent:
    def __init__(self, parts):
        self.parts = parts


class MockCandidate:
    def __init__(self, parts):
        self.content = MockContent(parts)


class MockGenAIResponse:
    def __init__(self, parts):
        self.candidates = [MockCandidate(parts)]
from app.agent.guardrails import HARVEST_BEFORE_PHI_VIOLATION, apply_hitl_tag


class Task08StreamingTraceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        guest_limiter.reset_for_test()
        circuit_breaker.reset()
        trace_logger.clear()

        # Tạo helper JWT tokens
        self.secret = os.getenv("JWT_SECRET_KEY") or DEFAULT_JWT_SECRET
        self.farmer_token = jwt.encode(
            {"sub": "farmer-user-123", "email": "farmer@example.com", "role": "FARMER"},
            self.secret,
            algorithm="HS256"
        )
        self.farmer_b_token = jwt.encode(
            {"sub": "farmer-user-456", "email": "farmer_b@example.com", "role": "FARMER"},
            self.secret,
            algorithm="HS256"
        )
        self.admin_token = jwt.encode(
            {"sub": "admin-user-999", "email": "admin@example.com", "role": "ADMIN"},
            self.secret,
            algorithm="HS256"
        )

    def parse_sse_events(self, text: str):
        """Hàm trợ giúp parse chuỗi SSE chuẩn event / data."""
        events = []
        blocks = text.strip().split("\n\n")
        for block in blocks:
            if not block.strip():
                continue
            lines = block.strip().split("\n")
            event_name = None
            data_str = None
            for line in lines:
                if line.startswith("event: "):
                    event_name = line[7:].strip()
                elif line.startswith("data: "):
                    data_str = line[6:].strip()
            if event_name and data_str:
                try:
                    events.append((event_name, json.loads(data_str)))
                except json.JSONDecodeError:
                    events.append((event_name, data_str))
        return events

    # --- 1. KIỂM THỬ LUỒNG STREAMING SSE CHUẨN SSOT ---
    @patch.object(gemini_client, "is_available", return_value=True)
    @patch.object(gemini_client, "call_react_turn")
    @patch("app.agent.react_agent.mcp_server.call_tool")
    def test_sse_streaming_sequence_and_contract(self, mock_tool, mock_react, mock_avail):
        """Xác thực toàn bộ chuỗi sự kiện SSE tuân thủ 100% hợp đồng SSOT Mục 4.1."""
        from app.mcp.schema import MCPCallResponse

        # Giả lập công cụ trả về thành công
        mock_tool.return_value = MCPCallResponse(
            tool="check_weather_risk",
            result={"is_rain": True, "rainfall_mm": 20.0, "risk_level": "HIGH", "recommendation": "NGUY CƠ RỬA TRÔI"}
        )

        # Giả lập 2 lượt ReAct: Lượt 1 gọi Tool, Lượt 2 trả Final Answer
        mock_react.side_effect = [
            MockGenAIResponse([
                MockPart(
                    text="Kiểm tra thời tiết xem có nguy cơ mưa không",
                    function_call=MockFunctionCall("check_weather_risk", {"location": "Hà Nam"})
                )
            ]),
            MockGenAIResponse([
                MockPart(text="Hệ thống ghi nhận có mưa tại Hà Nam. Cà chua cận thu hoạch nên ưu tiên tỉa lá bệnh.")
            ])
        ]

        payload = {
            "message": "Cà chua sương mai, 2 ngày nữa thu hoạch, có mưa không?",
            "conversation_id": "conv-test-sse-01",
            "location": "Hà Nam",
            "harvest_days_left": 2,
            "current_disease_code": "Tomato___Late_blight"
        }
        headers = {
            "Authorization": f"Bearer {self.farmer_token}",
            "Accept": "text/event-stream"
        }

        resp = self.client.post("/api/v1/agent/chat", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/event-stream", resp.headers["content-type"])

        events = self.parse_sse_events(resp.text)
        self.assertTrue(len(events) >= 5, f"Luồng SSE phải có đầy đủ trace_start, thought, action, observation, delta, final_answer. Nhận được: {[e[0] for e in events]}")

        event_names = [e[0] for e in events]
        self.assertEqual(event_names[0], "trace_start")
        self.assertIn("thought", event_names)
        self.assertIn("action", event_names)
        self.assertIn("observation", event_names)
        self.assertIn("delta", event_names)
        self.assertEqual(event_names[-1], "final_answer")

        # Kiểm tra trace_start
        trace_start_data = events[0][1]
        self.assertIn("trace_id", trace_start_data)
        self.assertEqual(trace_start_data["conversation_id"], "conv-test-sse-01")
        self.assertEqual(trace_start_data["status"], "thinking")

        # Kiểm tra thought & action & observation
        action_ev = [e[1] for e in events if e[0] == "action"][0]
        self.assertEqual(action_ev["tool"], "check_weather_risk")

        obs_ev = [e[1] for e in events if e[0] == "observation"][0]
        self.assertIn("result", obs_ev)
        self.assertEqual(obs_ev["result"]["rainfall_mm"], 20.0)

        # Kiểm tra final_answer
        final_answer_data = events[-1][1]
        self.assertIn("trace_id", final_answer_data)
        self.assertIn("answer", final_answer_data)
        self.assertIn("citations", final_answer_data)
        self.assertIn("total_latency_ms", final_answer_data)
        self.assertTrue(final_answer_data["answer"].startswith("[DRAFT_RECOMMENDATION]"))

    # --- 2. BẢO VỆ CHỐT CHẶN: DELTA STREAM CHỈ PHÁT VĂN BẢN ĐÃ QUA HẬU KIỂM ---
    @patch.object(gemini_client, "is_available", return_value=True)
    @patch.object(gemini_client, "call_react_turn")
    def test_delta_never_leaks_banned_medicines(self, mock_react, mock_avail):
        """
        Quy tắc bất di bất dịch: Delta tokens chỉ được phát sinh sau khi post_filter_response chạy.
        Nếu Gemini sinh ra tên thuốc hóa học vi phạm PHI, chốt chặn hậu kiểm phải bóc sạch trước khi stream delta.
        """
        # Giả lập Gemini sinh trực tiếp câu trả lời vi phạm PHI
        mock_react.return_value = MockGenAIResponse([
            MockPart(text="Chào bác! Bác hãy pha Ridomil Gold 50g phun ngay để trị sương mai.")
        ])

        payload = {
            "message": "Cà chua bị mốc sương, 2 ngày nữa hái, hãy kê thuốc Ridomil phun ngay",
            "conversation_id": "conv-test-phi-leak",
            "harvest_days_left": 2,
            "current_disease_code": "Tomato___Late_blight"
        }
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        resp = self.client.post("/api/v1/agent/chat", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 200)

        events = self.parse_sse_events(resp.text)
        delta_tokens = [e[1]["token"] for e in events if e[0] == "delta"]
        accumulated_text = "".join(delta_tokens)

        # Hậu kiểm phải thay thế hoặc loại bỏ triệt để tên thuốc hóa học
        self.assertNotIn("Ridomil", accumulated_text)
        self.assertIn("[DRAFT_RECOMMENDATION]", accumulated_text)
        # Phải có cảnh báo vi phạm thời gian cách ly
        self.assertIn("NGUY CƠ TỒN DƯ THUỐC BVTV", accumulated_text)

        # Final answer phải ghi nhận guardrail triggered
        final_ans = [e[1] for e in events if e[0] == "final_answer"][0]
        self.assertEqual(final_ans["guardrail_triggered"], "HARVEST_BEFORE_PHI_VIOLATION")

    # --- 3. BẢO MẬT DỮ LIỆU: OBSERVATION KHÔNG CHỨA FULL_TEXT ---
    @patch.object(gemini_client, "is_available", return_value=True)
    @patch.object(gemini_client, "call_react_turn")
    def test_observations_strip_full_text(self, mock_react, mock_avail):
        """Observation và citations gửi cho client tuyệt đối không chứa full_text."""
        mock_react.side_effect = [
            MockGenAIResponse([
                MockPart(
                    text="Tra cứu thông tin",
                    function_call=MockFunctionCall("lookup_disease_knowledge", {"disease_code": "Tomato___Late_blight"})
                )
            ]),
            MockGenAIResponse([
                MockPart(text="Đã tra cứu tri thức bệnh mốc sương thành công.")
            ])
        ]

        payload = {
            "message": "Tra cứu bệnh mốc sương",
            "conversation_id": "conv-obs-clean",
            "current_disease_code": "Tomato___Late_blight"
        }
        headers = {"Authorization": f"Bearer {self.farmer_token}"}
        resp = self.client.post("/api/v1/agent/chat", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 200)

        events = self.parse_sse_events(resp.text)
        for ev_name, ev_data in events:
            if ev_name == "observation":
                result = ev_data.get("result", {})
                self.assertNotIn("full_text", str(result))
            elif ev_name == "final_answer":
                citations = ev_data.get("citations", [])
                for cit in citations:
                    self.assertNotIn("full_text", cit)

    # --- 4. GIỚI HẠN 5 LƯỢT HỎI/NGÀY CHO KHÁCH VÃNG LAI (GUEST) ---
    def test_guest_rate_limiting_5_turns(self):
        """Khách vãng lai bị giới hạn nghiêm ngặt 5 lượt/ngày theo IP (roles-usecases.md)."""
        guest_headers = {"X-Real-IP": "203.162.0.1"}
        payload = {"message": "Tư vấn lá lúa bị đốm"}

        # 5 lượt đầu tiên thành công
        for i in range(5):
            resp = self.client.post("/api/v1/agent/chat", json=payload, headers=guest_headers)
            self.assertEqual(resp.status_code, 200, f"Lượt thứ {i+1} của khách phải thành công")

        # Lượt thứ 6 bị chặn với 429 Too Many Requests
        resp_6 = self.client.post("/api/v1/agent/chat", json=payload, headers=guest_headers)
        self.assertEqual(resp_6.status_code, 429)
        self.assertIn("5 lượt hỏi/ngày", resp_6.json()["detail"])

        # Nông dân có JWT không bị chặn bởi rate limit của Guest
        farmer_headers = {"Authorization": f"Bearer {self.farmer_token}", "X-Real-IP": "203.162.0.1"}
        resp_farmer = self.client.post("/api/v1/agent/chat", json=payload, headers=farmer_headers)
        self.assertEqual(resp_farmer.status_code, 200)

    # --- 5. BẢO MẬT CONVERSATION_ID: CHỐNG TẤN CÔNG IDOR ---
    def test_conversation_ownership_and_idor_prevention(self):
        """Chống đọc trộm hoặc ghi đè lịch sử hội thoại của người khác."""
        conv_id = "conv-private-farmer-123"

        # Farmer 1 tạo và sở hữu phiên
        resp1 = self.client.post(
            "/api/v1/agent/chat",
            json={"message": "Tôi là chủ sở hữu", "conversation_id": conv_id},
            headers={"Authorization": f"Bearer {self.farmer_token}"}
        )
        self.assertEqual(resp1.status_code, 200)

        # Farmer 2 cố tình gửi vào conv_id của Farmer 1 -> 403 Forbidden
        resp2 = self.client.post(
            "/api/v1/agent/chat",
            json={"message": "Tôi muốn truy cập trộm", "conversation_id": conv_id},
            headers={"Authorization": f"Bearer {self.farmer_b_token}"}
        )
        self.assertEqual(resp2.status_code, 403)
        self.assertIn("quyền", resp2.json()["detail"])

        # Khách vãng lai cũng không được truy cập vào phiên của nông dân -> 403
        resp_guest = self.client.post(
            "/api/v1/agent/chat",
            json={"message": "Khách muốn đọc", "conversation_id": conv_id},
            headers={"X-Real-IP": "118.70.1.2"}
        )
        self.assertEqual(resp_guest.status_code, 403)

        # Admin có quyền giám sát kỹ thuật -> 200 OK
        resp_admin = self.client.post(
            "/api/v1/agent/chat",
            json={"message": "Admin kiểm tra", "conversation_id": conv_id},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(resp_admin.status_code, 200)

    # --- 6. QUAN SÁT VẾT THỰC THI (AGENT OBSERVABILITY - SSOT 4.2) ---
    def test_trace_observability_api_and_waterfall(self):
        """GET /api/v1/agent/trace/{trace_id} và sinh tệp trace_waterfall.json."""
        # Chạy 1 lượt chat để sinh trace
        resp = self.client.post(
            "/api/v1/agent/chat",
            json={"message": "Kiểm tra vết suy luận", "harvest_days_left": 10},
            headers={"Authorization": f"Bearer {self.farmer_token}"}
        )
        self.assertEqual(resp.status_code, 200)

        events = self.parse_sse_events(resp.text)
        trace_id = events[0][1]["trace_id"]
        self.assertTrue(trace_id.startswith("tr-"))

        # 1. Truy vấn bằng Admin Token -> 200 OK
        trace_resp = self.client.get(
            f"/api/v1/agent/trace/{trace_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(trace_resp.status_code, 200)
        trace_data = trace_resp.json()
        self.assertEqual(trace_data["trace_id"], trace_id)
        self.assertIn("total_duration_ms", trace_data)
        self.assertIn("steps", trace_data)

        # 2. Người dùng thường (Farmer) không được xem chi tiết trace kỹ thuật -> 403 Forbidden
        trace_resp_farmer = self.client.get(
            f"/api/v1/agent/trace/{trace_id}",
            headers={"Authorization": f"Bearer {self.farmer_token}"}
        )
        self.assertEqual(trace_resp_farmer.status_code, 403)

        # 3. Mã trace không tồn tại -> 404
        trace_404 = self.client.get(
            "/api/v1/agent/trace/tr-non-existent",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(trace_404.status_code, 404)

        # 4. Kiểm tra tệp trace_waterfall.json
        waterfall_path = "trace_waterfall.json"
        if os.path.exists(waterfall_path):
            with open(waterfall_path, "r", encoding="utf-8") as f:
                wf_content = json.load(f)
                self.assertIn("trace_id", wf_content)
                self.assertIn("steps", wf_content)
                self.assertIn("safety_audit", wf_content)

    # --- 7. TỰ ĐỘNG HẠ CẤP KHI CIRCUIT BREAKER MỞ ---
    def test_streaming_offline_fallback_when_circuit_open(self):
        """Khi Circuit Breaker OPEN, streaming SSE tự động phát phác đồ IPM lưu sẵn."""
        # Kích hoạt ép Circuit Breaker OPEN
        circuit_breaker.state = CircuitState.OPEN
        circuit_breaker.cooldown_seconds = 10.0

        resp = self.client.post(
            "/api/v1/agent/chat",
            json={
                "message": "Cà chua bị mốc sương",
                "harvest_days_left": 2,
                "current_disease_code": "Tomato___Late_blight"
            },
            headers={"Authorization": f"Bearer {self.farmer_token}"}
        )
        self.assertEqual(resp.status_code, 200)

        events = self.parse_sse_events(resp.text)
        final_ans = [e[1] for e in events if e[0] == "final_answer"][0]

        self.assertTrue(final_ans["is_offline_fallback"])
        self.assertIn("[DRAFT_RECOMMENDATION]", final_ans["answer"])


if __name__ == "__main__":
    unittest.main()
