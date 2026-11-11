import json
import sys
import tempfile
import time
import uuid
import unittest
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

# Thêm đường dẫn app vào sys.path
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))
sys.path.insert(0, str(CURRENT_DIR / "scripts"))

from app.agent.memory import ShortTermMemory, stm_memory
from app.agent.guardrails import (
    DRAFT_RECOMMENDATION_TAG,
    HARVEST_BEFORE_PHI_VIOLATION,
    pre_filter_medicines,
    post_filter_response,
    strip_unsourced_dosage,
    apply_hitl_tag
)
from app.agent.resilience import (
    CircuitBreaker,
    CircuitState,
    OfflineRouter,
    circuit_breaker
)
from app.agent.gemini_client import GEMINI_TIMEOUT_MS
from app.agent.react_agent import ReActAgent, MAX_TOTAL_TOOL_CALLS, extract_harvest_days_from_text
from app.mcp.schema import MCPCallResponse
from export_offline_cache import build_offline_cache


# --- MOCK CLASSES BẢO TOÀN CẤU TRÚC GOOGLE-GENAI SDK ---
class MockPart:
    def __init__(self, function_call=None, text=None, thought_signature="mock_sig_123"):
        self.function_call = function_call
        self.text = text
        self.thought_signature = thought_signature


class MockFunctionCall:
    def __init__(self, name, args):
        self.name = name
        self.args = args


class MockCandidateContent:
    def __init__(self, parts, role="model"):
        self.parts = parts
        self.role = role


class MockCandidate:
    def __init__(self, parts):
        self.content = MockCandidateContent(parts)


class MockGeminiResponse:
    def __init__(self, parts):
        self.candidates = [MockCandidate(parts)]


class TestTask07ReActGuardrails(unittest.TestCase):
    """
    Bộ kiểm thử nghiệm thu nâng cao TASK-07:
    Kiểm chứng nghiêm ngặt toàn bộ các tiêu chí an toàn, chốt chặn bằng code,
    bảo toàn thought_signature của SDK Gemini, và chống gán nhầm cây trồng ở chế độ offline.
    """

    def setUp(self):
        circuit_breaker.reset()

    # =========================================================================
    # 1. KIỂM THỬ IN-MEMORY STM (K=3, TTL, LRU SESSION LIMIT)
    # =========================================================================
    def test_01_stm_rolling_window_ttl_and_lru(self):
        print("\n--- 1. KIỂM THỬ IN-MEMORY STM (K=3, TTL & LRU LIMIT) ---")
        memory = ShortTermMemory(max_turns=3, ttl_seconds=2, max_sessions=5)
        conv_id = f"test-stm-{uuid.uuid4().hex[:8]}"

        # 3 lượt đầu
        memory.add_turn(conv_id, "Cà chua bị đốm lá", "Có thể là bệnh mốc sương hoặc đốm vòng.")
        memory.add_turn(conv_id, "Loại này pha mấy nắp?", "Pha 30g cho bình 16L.")
        memory.add_turn(conv_id, "Giá bao nhiêu một gói?", "Khoảng 55.000 VNĐ.")

        history = memory.get_history(conv_id)
        self.assertEqual(len(history), 6)
        self.assertEqual(history[0]["content"], "Cà chua bị đốm lá")

        # Lượt 4: Lượt 1 bị đẩy khỏi Rolling Window K=3
        memory.add_turn(conv_id, "Có ship tận vườn không?", "Có hỗ trợ giao tận vườn.")
        history_updated = memory.get_history(conv_id)
        self.assertEqual(len(history_updated), 6)
        self.assertEqual(history_updated[0]["content"], "Loại này pha mấy nắp?")
        print("[OK] Rolling Window K=3 đẩy đúng lượt cũ nhất ra ngoài.")

        # Thử nghiệm LRU Max Sessions: Tạo 6 sessions, session đầu tiên phải bị dọn
        for i in range(6):
            memory.add_turn(f"conv-batch-{i}", f"Câu hỏi {i}", f"Trả lời {i}")
        # conv_id ban đầu phải bị đẩy ra do vượt quá max_sessions=5
        self.assertEqual(len(memory.get_history(conv_id)), 0)
        print("[OK] LRU Session Limiter: Tự động dọn dẹp các phiên cũ nhất khi vượt quá giới hạn RAM.")

        # Thử nghiệm TTL hết hạn
        time.sleep(2.1)
        self.assertEqual(len(memory.get_history("conv-batch-5")), 0)
        print("[OK] TTL Session: Tự động giải phóng bộ nhớ sau thời gian hết hạn.")

    # =========================================================================
    # 2. KIỂM THỬ CHỐT CHẶN TIỀN LỌC (HARD PRE-FILTER GUARDRAIL)
    # =========================================================================
    def test_02_pre_filter_hard_guardrail(self):
        print("\n--- 2. KIỂM THỬ CHỐT CHẶN TIỀN LỌC (PRE-FILTER) ---")
        mock_medicines = [
            {"name": "Ridomil Gold 68WG", "active_ingredient": "Metalaxyl-M + Mancozeb", "phi_days": 7, "is_allowed": True, "medicine_type": "Hóa học"},
            {"name": "Antracol 70WP", "active_ingredient": "Propineb", "phi_days": 7, "is_allowed": True, "medicine_type": "Hóa học"},
            {"name": "Chế phẩm Trichoderma", "active_ingredient": "Trichoderma spp.", "phi_days": 0, "is_allowed": True, "medicine_type": "Sinh học"},
            {"name": "Thuốc cỏ Paraquat Cấm", "active_ingredient": "", "phi_days": 999, "is_allowed": False, "medicine_type": "Hóa chất cấm"},
            {"name": "Thuốc cỏ 2,4-D", "active_ingredient": "2.4-D Dichlorophenoxyacetic", "phi_days": 999, "is_allowed": False, "medicine_type": "Hóa chất cấm"},
        ]

        # Ca 1: Còn 2 ngày thu hoạch -> Chặn 100% thuốc hóa học
        filtered, violated, reasons = pre_filter_medicines(mock_medicines, harvest_days_left=2)
        self.assertTrue(violated)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["name"], "Chế phẩm Trichoderma")
        print("[OK] harvest_days=2: Loại bỏ 100% thuốc hóa học (Ridomil, Antracol), chỉ giữ Trichoderma (PHI=0).")

        # Ca 2: harvest_days_left = None -> Mặc định coi như sắp thu hoạch (0 ngày)
        filtered_none, violated_none, _ = pre_filter_medicines(mock_medicines, harvest_days_left=None)
        self.assertTrue(violated_none)
        self.assertEqual(len(filtered_none), 1)
        self.assertEqual(filtered_none[0]["name"], "Chế phẩm Trichoderma")
        print("[OK] harvest_days=None: Chặn toàn bộ thuốc hóa học theo nguyên tắc bảo thủ tối đa.")

        # Ca 3: Tên thuốc chứa Paraquat dù active_ingredient rỗng -> Bắt buộc bị loại
        for med in filtered:
            self.assertNotIn("paraquat", med["name"].lower())
            self.assertNotIn("2,4-d", med["name"].lower())
        print("[OK] Quét cả tên thương phẩm và hoạt chất: Thuốc cấm bị loại bỏ triệt để.")

    # =========================================================================
    # 3. KIỂM THỬ HẬU KIỂM: BÓC TÁCH TRIỆT ĐỂ TÊN THUỐC VI PHẠM (POST-FILTER)
    # =========================================================================
    def test_03_post_filter_strips_violating_chemicals(self):
        print("\n--- 3. KIỂM THỬ HẬU KIỂM: BÓC TÁCH TRIỆT ĐỂ TÊN THUỐC VI PHẠM ---")

        # Ca 1: AI cố tình khuyên dùng Ridomil khi còn 2 ngày thu hoạch
        bad_ai_answer_1 = "Chào bác! Vườn cà chua bị mốc sương, bác pha Ridomil Gold 50g cho bình 16L phun ngay để trị nấm."
        cleaned_1 = post_filter_response(bad_ai_answer_1, harvest_days_left=2, had_phi_violation=True)

        # KIỂM CHỨNG NGHIÊM NGẶT: Tên Ridomil KHÔNG ĐƯỢC PHÉP CÒN trong câu trả lời!
        self.assertNotIn("Ridomil", cleaned_1, "Tên thuốc vi phạm PHI 'Ridomil' bắt buộc phải bị bóc tách khỏi câu trả lời!")
        self.assertIn("⛔ NGUY CƠ TỒN DƯ THUỐC BVTV", cleaned_1)
        self.assertIn("Trichoderma", cleaned_1)
        print("[OK] Ca 'pha Ridomil 50g, phun ngay' (2 ngày): Tên Ridomil bị gỡ bỏ sạch, thay bằng cảnh báo đỏ tồn dư.")

        # Ca 2: AI khuyên hoạt chất Mancozeb khi còn 2 ngày thu hoạch
        bad_ai_answer_2 = "Cây có triệu chứng nặng, bác nên mua hoạt chất Mancozeb liều 50g về phun dập dịch."
        cleaned_2 = post_filter_response(bad_ai_answer_2, harvest_days_left=2, had_phi_violation=True)
        self.assertNotIn("Mancozeb", cleaned_2)
        self.assertIn("⛔ NGUY CƠ TỒN DƯ THUỐC BVTV", cleaned_2)
        print("[OK] Ca 'hoạt chất Mancozeb liều 50g' (2 ngày): Hoạt chất Mancozeb bị bóc tách triệt để.")

        # Ca 3: AI bịa thuốc cấm Paraquat
        bad_ai_answer_3 = "Bác dùng thuốc trừ cỏ Paraquat pha loãng xịt quanh gốc cây để làm sạch cỏ dại."
        cleaned_3 = post_filter_response(bad_ai_answer_3, harvest_days_left=15)
        self.assertNotIn("paraquat", cleaned_3.lower())
        self.assertIn("⛔ CẢNH BÁO AN TOÀN BẢO VỆ THỰC VẬT", cleaned_3)
        print("[OK] Ca 'thuốc trừ cỏ Paraquat': Tên hoạt chất cấm bị gỡ bỏ hoàn toàn khỏi câu trả lời.")

        # Ca 4: Gắn nhãn HITL [DRAFT_RECOMMENDATION]
        tagged = apply_hitl_tag("Chào bác, cây cần tưới đủ nước.")
        self.assertTrue(tagged.startswith(DRAFT_RECOMMENDATION_TAG))
        print("[OK] Nhãn [DRAFT_RECOMMENDATION] luôn hiện diện trong mọi khuyến nghị.")

    # =========================================================================
    # 4. KIỂM THỬ OFFLINE: KHÔNG TRÍCH DẪN NHẦM CÂY TRỒNG KHÁC & DỮ LIỆU SEED THẬT
    # =========================================================================
    def test_04_offline_router_prevents_cross_plant_hallucination(self):
        print("\n--- 4. KIỂM THỬ OFFLINE: CHỐNG TRÍCH DẪN NHẦM CÂY TRỒNG KHÁC ---")

        # Dùng cache dựng từ seed trong repo để kết quả không phụ thuộc dữ liệu đang có trên CSDL
        with tempfile.TemporaryDirectory() as tmp:
            cache_path = Path(tmp) / "cache.json"
            cache_path.write_text(json.dumps(build_offline_cache(from_seed=True), ensure_ascii=False), encoding="utf-8")
            offline_router = OfflineRouter(cache_path=cache_path)

        # Ca 1: Người dùng hỏi "Cà phê bị gỉ sắt"
        res_coffee = offline_router.get_offline_solution(
            disease_code=None,
            harvest_days_left=30,
            user_query="Vườn cà phê ở Tây Nguyên bị nấm gỉ sắt làm rụng lá nhiều xử lý sao?"
        )
        self.assertTrue(res_coffee["is_offline_fallback"])
        # TUYỆT ĐỐI KHÔNG ĐƯỢC RA PHÁC ĐỒ CỦA NGÔ (BẮP)!
        self.assertNotIn("ngô", res_coffee["final_answer"].lower())
        self.assertNotIn("bắp", res_coffee["final_answer"].lower())
        self.assertNotIn("Corn_(maize)", str(res_coffee))
        self.assertEqual(len(res_coffee["citations"]), 0, "Không được cấp citation của cây ngô cho câu hỏi cà phê!")
        print("[OK] 'Cà phê gỉ sắt': Không bị gán bậy sang phác đồ Gỉ sắt ngô, chuyển về khuyến cáo chung.")

        # Ca 2: Người dùng hỏi "Khoai tây bị đốm vòng"
        res_potato = offline_router.get_offline_solution(
            disease_code=None,
            harvest_days_left=30,
            user_query="Ruộng khoai tây bị đốm vòng thì xịt thuốc gì?"
        )
        # TUYỆT ĐỐI KHÔNG ĐƯỢC RA PHÁC ĐỒ CỦA CÀ CHUA!
        self.assertNotIn("cà chua", res_potato["final_answer"].lower())
        self.assertEqual(len(res_potato["citations"]), 0)
        print("[OK] 'Khoai tây đốm vòng': Không bị gán bậy sang Cà chua, chuyển về khuyến cáo chung.")

        # Ca 3: Ca chuẩn đúng Cây và Bệnh demo (Cà chua mốc sương)
        res_tomato = offline_router.get_offline_solution(
            disease_code="Tomato___Late_blight",
            harvest_days_left=2,
            user_query="Cà chua bị mốc sương"
        )
        self.assertIn("Tomato___Late_blight", res_tomato["disease_code"])
        # Khi harvest_days_left = 2: TUYỆT ĐỐI KHÔNG có Ridomil hay Antracol
        self.assertNotIn("Ridomil", res_tomato["final_answer"])
        self.assertNotIn("Antracol", res_tomato["final_answer"])
        self.assertIn("KHÔNG SỬ DỤNG THUỐC HÓA HỌC", res_tomato["final_answer"])
        # Kiểm tra trích dẫn từ Seed thật
        self.assertGreaterEqual(len(res_tomato["citations"]), 1)
        citation = res_tomato["citations"][0]
        # URL thật từ seed (khuyennongvn.gov.vn)
        self.assertIn("khuyennongvn.gov.vn", citation["source_url"])
        self.assertEqual(citation["source_id"], "40a6c901-ca07-465d-a960-89643a8d2bca")
        # Seed không đánh dấu nguyên văn thì không được nhận là trích dẫn nguyên văn
        self.assertFalse(citation["is_verbatim"])
        print(f"[OK] Cà chua mốc sương: Trả đúng citation thật ({citation['source_id']}), loại bỏ sạch thuốc hóa học khi còn 2 ngày thu hoạch.")

    # =========================================================================
    # 5. KIỂM THỬ CIRCUIT BREAKER: BỎ QUA LỖI 4XX & CHỈ 1 PROBE KHI HALF-OPEN
    # =========================================================================
    def test_05_circuit_breaker_robustness(self):
        print("\n--- 5. KIỂM THỬ CIRCUIT BREAKER ROBUSTNESS ---")
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=0.4)

        # Lỗi 4xx của client không được tính vào lỗi hệ thống
        cb.record_failure(ValueError("400 Client Error: INVALID_ARGUMENT"))
        cb.record_failure(ValueError("422 Validation Error"))
        self.assertEqual(cb.consecutive_failures, 0, "Lỗi 4xx không được làm tăng failure count của Circuit Breaker!")
        self.assertEqual(cb.state, CircuitState.CLOSED)
        print("[OK] Circuit Breaker bỏ qua lỗi 4xx của client, tránh sự cố 1 người làm sập toàn hệ thống.")

        # 3 lỗi hạ tầng 5xx / ConnectionError thật
        cb.record_failure(ConnectionError("503 Upstream Service Unavailable"))
        cb.record_failure(TimeoutError("Connection timeout 30s"))
        cb.record_failure(ConnectionError("Network connection reset"))
        self.assertEqual(cb.state, CircuitState.OPEN)
        self.assertFalse(cb.can_execute())
        print("[OK] Đủ 3 lỗi hạ tầng: Chuyển mạch sang OPEN thành công.")

        # Chờ Cooldown -> HALF_OPEN (chỉ 1 probe)
        time.sleep(0.45)
        self.assertTrue(cb.can_execute())
        self.assertEqual(cb.state, CircuitState.HALF_OPEN)
        # Request thứ 2 cùng lúc trong trạng thái HALF_OPEN phải bị từ chối
        self.assertFalse(cb.can_execute(), "Chỉ đúng 1 request được phép thăm dò trong trạng thái HALF_OPEN!")

        # Probe thành công -> CLOSED
        cb.record_success()
        self.assertEqual(cb.state, CircuitState.CLOSED)
        print("[OK] HALF_OPEN chỉ cho 1 probe và phục hồi về CLOSED khi probe thành công.")

    # =========================================================================
    # 6. KIỂM THỬ REACT LOOP VỚI CẤU TRÚC CANDIDATE NGUYÊN VẸN & GỘP RESPONSES
    # =========================================================================
    def test_06_react_loop_preserves_thought_signature_and_merges_responses(self):
        print("\n--- 6. KIỂM THỬ REACT LOOP: BẢO TOÀN THOUGHT SIGNATURE & GỘP TOOL RESPONSES ---")
        agent = ReActAgent(max_iterations=5)

        # Tạo candidate có thought_signature chuẩn
        turn_1_content = MockCandidateContent([
            MockPart(
                text="Tôi sẽ gọi đồng thời kiểm tra thời tiết và kho thuốc.",
                function_call=MockFunctionCall("check_weather_risk", {"location": "Hà Nam", "forecast_hours": 12}),
                thought_signature="valid_model_signature_turn1"
            )
        ])
        mock_response_1 = MagicMock()
        mock_response_1.candidates = [MagicMock(content=turn_1_content)]

        turn_2_content = MockCandidateContent([
            MockPart(
                text="Tôi kiểm tra kho thuốc.",
                function_call=MockFunctionCall("query_pesticide_store", {"disease_code": "Tomato___Late_blight"}),
                thought_signature="valid_model_signature_turn2"
            )
        ])
        mock_response_2 = MagicMock()
        mock_response_2.candidates = [MagicMock(content=turn_2_content)]

        # Turn 3: AI cố tình gợi ý thuốc hóa học Ridomil khi còn 2 ngày thu hoạch
        turn_3_content = MockCandidateContent([
            MockPart(
                text="Chào bác! Trời Hà Nam mưa to và cà chua bị mốc sương, bác pha Ridomil Gold 50g xịt ngay để chặn nấm."
            )
        ])
        mock_response_3 = MagicMock()
        mock_response_3.candidates = [MagicMock(content=turn_3_content)]

        recorded_contents: List[Any] = []

        def mock_call_react_turn(contents, tools_declarations=None, system_instruction=None):
            recorded_contents.append(list(contents))
            idx = len(recorded_contents) - 1
            if idx == 0:
                return mock_response_1
            elif idx == 1:
                return mock_response_2
            else:
                return mock_response_3

        def mock_call_tool(tool_name, arguments):
            from app.mcp.schema import MCPCallResponse
            if tool_name == "check_weather_risk":
                return MCPCallResponse(
                    tool=tool_name,
                    is_error=False,
                    result={"location": "Hà Nam", "is_rain": True, "rainfall_mm": 20.0, "risk_level": "HIGH"},
                    execution_time_ms=5.0
                )
            elif tool_name == "query_pesticide_store":
                return MCPCallResponse(
                    tool=tool_name,
                    is_error=False,
                    result={
                        "disease_code": "Tomato___Late_blight",
                        "total": 2,
                        "items": [
                            {"name": "Ridomil Gold 68WG", "active_ingredient": "Metalaxyl-M + Mancozeb", "phi_days": 7, "is_allowed": True, "medicine_type": "Hóa học"},
                            {"name": "Chế phẩm Trichoderma", "active_ingredient": "Trichoderma spp.", "phi_days": 0, "is_allowed": True, "medicine_type": "Sinh học"}
                        ]
                    },
                    execution_time_ms=5.0
                )
            return MCPCallResponse(tool=tool_name, is_error=False, result={}, execution_time_ms=1.0)

        with patch("app.agent.react_agent.gemini_client.call_react_turn", side_effect=mock_call_react_turn):
            with patch("app.agent.react_agent.gemini_client.is_available", return_value=True):
                with patch("app.agent.react_agent.mcp_server.call_tool", side_effect=mock_call_tool):
                    resp = agent.run(
                        message="Cà chua bị mốc sương, 2 ngày nữa thu hoạch, chiều nay mưa thì phun gì?",
                        conversation_id="conv-react-full-01",
                        disease_code="Tomato___Late_blight",
                        location="Hà Nam",
                        harvest_days_left=2
                    )

        # 1. Kiểm tra cấu trúc contents gửi sang model:
        # Lượt của Model gửi lại ở lượt tiếp theo PHẢI LÀ đối tượng candidate_content nguyên vẹn
        turn2_sent_contents = recorded_contents[1]
        model_turn_in_contents = turn2_sent_contents[-2]
        self.assertIs(model_turn_in_contents, turn_1_content, "Phải giữ nguyên đối tượng candidate.content chứa thought_signature!")

        # Lượt của User phải chứa function_response
        user_response_in_contents = turn2_sent_contents[-1]
        self.assertEqual(user_response_in_contents["role"], "user")
        self.assertIn("function_response", user_response_in_contents["parts"][0])
        print("[OK] Bảo toàn thought_signature: Trả nguyên candidate.content và gộp function_response vào lượt user.")

        # 2. Kiểm tra câu trả lời cuối cùng: Dù AI bảo phun Ridomil, chốt chặn Hậu kiểm PHẢI XÓA SẠCH RIDOMIL
        self.assertNotIn("Ridomil", resp.final_answer, "Tên Ridomil tuyệt đối không được xuất hiện khi còn 2 ngày thu hoạch!")
        self.assertIn("⛔ NGUY CƠ TỒN DƯ THUỐC BVTV", resp.final_answer)
        self.assertTrue(resp.final_answer.startswith(DRAFT_RECOMMENDATION_TAG))
        print("[OK] Hậu kiểm can thiệp thành công: Bóc sạch Ridomil khỏi câu trả lời của AI.")

    # =========================================================================
    # 7. KIỂM THỬ CORE API SẬP: TỰ ĐỘNG CHUYỂN OFFLINE, KHÔNG BỊA ĐOÁN
    # =========================================================================
    def test_07_core_api_failure_triggers_offline_fallback(self):
        print("\n--- 7. KIỂM THỬ CORE API SẬP: TỰ ĐỘNG CHUYỂN OFFLINE ---")
        agent = ReActAgent(max_iterations=5)

        turn_content = MockCandidateContent([
            MockPart(
                text="Tôi sẽ tra cứu kho thuốc.",
                function_call=MockFunctionCall("query_pesticide_store", {"disease_code": "Tomato___Late_blight"})
            )
        ])
        mock_resp = MagicMock(candidates=[MagicMock(content=turn_content)])

        def mock_call_tool_fail(tool_name, arguments):
            from app.mcp.schema import MCPCallResponse
            return MCPCallResponse(
                tool=tool_name,
                is_error=True,
                result=None,
                error_code="UPSTREAM_UNAVAILABLE",
                error_message="Core API connection refused at port 8080"
            )

        with patch("app.agent.react_agent.gemini_client.call_react_turn", return_value=mock_resp):
            with patch("app.agent.react_agent.gemini_client.is_available", return_value=True):
                with patch("app.agent.react_agent.mcp_server.call_tool", side_effect=mock_call_tool_fail):
                    resp = agent.run(
                        message="Cà chua bị bệnh xử lý sao?",
                        disease_code="Tomato___Late_blight",
                        harvest_days_left=2
                    )

        # Phải tự động chuyển sang offline fallback thay vì tiếp tục cho AI đoán mò
        self.assertTrue(resp.is_offline_fallback)
        self.assertIn("CHẾ ĐỘ NGOẠI TUYẾN", resp.final_answer)
        self.assertGreaterEqual(circuit_breaker.consecutive_failures, 1)
        print("[OK] Core API sập: Tự động ghi nhận lỗi Circuit Breaker và chuyển ngay sang Offline phác đồ IPM kiểm định.")

    # =========================================================================
    # 8. KIỂM THỬ KHỐNG CHẾ LẶP VÔ HẠN (MAX ITERATIONS = 5)
    # =========================================================================
    def test_08_infinite_loop_prevention_with_smart_summary(self):
        print("\n--- 8. KIỂM THỬ KHỐNG CHẾ LẶP VÔ HẠN VÀ TỔNG HỢP QUAN SÁT ---")
        agent = ReActAgent(max_iterations=5)

        infinite_content = MockCandidateContent([
            MockPart(
                text="Tôi tiếp tục suy nghĩ và gọi lại tool...",
                function_call=MockFunctionCall("check_weather_risk", {"location": "Hà Nam"})
            )
        ])
        mock_resp = MagicMock(candidates=[MagicMock(content=infinite_content)])

        def mock_call_tool(tool_name, arguments):
            from app.mcp.schema import MCPCallResponse
            return MCPCallResponse(
                tool=tool_name,
                is_error=False,
                result={"location": "Hà Nam", "is_rain": False, "risk_level": "LOW"},
                execution_time_ms=1.0
            )

        with patch("app.agent.react_agent.gemini_client.call_react_turn", return_value=mock_resp):
            with patch("app.agent.react_agent.gemini_client.is_available", return_value=True):
                with patch("app.agent.react_agent.mcp_server.call_tool", side_effect=mock_call_tool):
                    resp = agent.run(
                        message="Thời tiết thế nào?",
                        conversation_id="conv-infinite-test",
                        disease_code="Tomato___Late_blight",
                        harvest_days_left=5
                    )

        # Buộc phải dừng lại sau 5 bước và tổng hợp được thông tin thời tiết
        self.assertIsNotNone(resp.final_answer)
        self.assertTrue(resp.final_answer.startswith(DRAFT_RECOMMENDATION_TAG))
        self.assertIn("Hà Nam", resp.final_answer)
        print("[OK] Khống chế lặp vô hạn: Dừng lại sau đúng 5 bước và tổng hợp thông minh thông tin quan sát được.")


def gemini_reply(*parts):
    return MagicMock(candidates=[MagicMock(content=MockCandidateContent(list(parts)))])


def tool_call(name, **args):
    return MockPart(function_call=MockFunctionCall(name, args))


def store_result(tool_name, arguments):
    return MCPCallResponse(tool=tool_name, result={
        "disease_code": "Tomato___Late_blight",
        "total": 3,
        "is_fallback": False,
        "items": [
            {"id": 1, "name": "Ridomil Gold 68WG", "active_ingredient": "Metalaxyl-M 40g/kg + Mancozeb 640g/kg", "medicine_type": "Hóa học",
             "dosage_instruction": "Pha 50g cho bình 16L", "phi_days": 7, "is_allowed": True},
            {"id": 4, "name": "Thuốc trừ nấm Score 250EC", "active_ingredient": "Difenoconazole 250g/L", "medicine_type": "Hóa học",
             "dosage_instruction": "Pha 10ml cho bình 16L", "phi_days": 14, "is_allowed": True},
            {"id": 3, "name": "Chế phẩm Trichoderma", "active_ingredient": "Trichoderma spp.", "medicine_type": "Sinh học",
             "dosage_instruction": "Pha 30g cho bình 16L", "phi_days": 0, "is_allowed": True}
        ]
    })


def run_agent(replies, tool=store_result, **kwargs):
    """Chạy ReAct với Gemini và MCP giả lập; trả về (kết quả, các lần gửi contents, số lần gọi tool)."""
    sent = []
    tool_mock = MagicMock(side_effect=tool)
    queue = list(replies)

    def fake_llm(contents, tools_declarations=None, system_instruction=None):
        sent.append(list(contents))
        reply = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(reply, Exception):
            raise reply
        return reply

    kwargs.setdefault("message", "Cà chua bị bệnh")
    with patch("app.agent.react_agent.gemini_client.call_react_turn", side_effect=fake_llm), \
            patch("app.agent.react_agent.gemini_client.is_available", return_value=True), \
            patch("app.agent.react_agent.mcp_server.call_tool", tool_mock):
        return ReActAgent(max_iterations=5).run(**kwargs), sent, tool_mock.call_count


class TestGuardrailRegressions(unittest.TestCase):
    """Các hành vi an toàn từng bị lọt khi rà soát TASK-07. Bỏ chốt chặn tương ứng thì các test này phải đỏ."""

    def setUp(self):
        circuit_breaker.reset()

    def test_pre_filter_fails_closed(self):
        unknown_phi_zero = {"name": "Hoá X", "active_ingredient": "x", "phi_days": 0, "is_allowed": True, "medicine_type": "Hóa học"}
        self.assertEqual(pre_filter_medicines([unknown_phi_zero], None)[0], [])
        bio_with_phi = {"name": "SH", "active_ingredient": "x", "phi_days": 5, "is_allowed": True, "medicine_type": "Sinh học"}
        self.assertEqual(pre_filter_medicines([bio_with_phi], 2)[0], [])
        self.assertEqual(pre_filter_medicines([{"name": "Thiếu dữ liệu", "active_ingredient": "x"}], 30)[0], [])
        self.assertEqual(pre_filter_medicines([{"name": "Gramoxone", "active_ingredient": "", "phi_days": 1, "is_allowed": True}], 30)[0], [])
        self.assertEqual(pre_filter_medicines([{"name": "Thuốc 2.4-D", "active_ingredient": "", "phi_days": 1, "is_allowed": True}], 30)[0], [])
        boundary = {"name": "Biên", "active_ingredient": "x", "phi_days": 7, "is_allowed": True, "medicine_type": "Hóa học"}
        self.assertEqual(pre_filter_medicines([boundary], 7)[0], [], "DaysToHarvest = PhiDays vẫn phải bị chặn")
        self.assertEqual(len(pre_filter_medicines([boundary], 8)[0]), 1)

    def test_farming_supply_without_phi_does_not_block_medicines(self):
        """TASK-15: thêm một cái lưới (không PHI) không được làm Lavi mất gợi ý thuốc hay bật cảnh báo đỏ."""
        net = {"name": "Lưới chắn côn trùng", "active_ingredient": None, "phi_days": None, "is_allowed": True,
               "medicine_type": "Vật tư canh tác", "availability": "NOT_SOLD"}
        chem = {"name": "Thuốc A", "active_ingredient": "x", "phi_days": 7, "is_allowed": True, "medicine_type": "Hóa học"}
        kept, violated, _ = pre_filter_medicines([net, chem], 30)
        self.assertEqual(kept, [net, chem])
        self.assertFalse(violated)
        # Thuốc thiếu PHI vẫn bị chặn; khai "vật tư" với tên thuốc cấm vẫn bị chặn
        self.assertEqual(pre_filter_medicines([dict(chem, phi_days=None)], 30)[0], [])
        self.assertEqual(pre_filter_medicines([dict(net, name="Paraquat")], 30)[0], [])

    def test_post_filter_removes_leftover_dosage(self):
        for bad in ("Bác dùng Ridomil Gold. Pha 50g cho bình 16L rồi phun ngay.",
                    "- Thuốc: Ridomil\n- Liều: 50g cho bình 16L",
                    "Dùng Ridomil 0.5 kg cho một sào."):
            cleaned = post_filter_response(bad, 2)
            self.assertNotIn("ridomil", cleaned.lower(), bad)
            self.assertNotRegex(cleaned, r"50g|0\.5|5 kg", bad)
            self.assertIn("⛔ NGUY CƠ TỒN DƯ THUỐC BVTV", cleaned)

    def test_post_filter_blocks_catalog_and_unlisted_chemicals(self):
        self.assertNotIn("Daconil", post_filter_response("Bạn pha Daconil 20ml phun ngay.", 2))
        cleaned = post_filter_response(
            "Bạn pha SuperFungi 20ml phun ngay.", 5,
            blocked_medicines=[{"name": "SuperFungi 25SC", "active_ingredient": "Abcxyzole 250g/L"}]
        )
        self.assertNotIn("SuperFungi", cleaned)

    def test_post_filter_keeps_safe_answer_and_does_not_contradict(self):
        safe = "Bạn có thể dùng Ridomil, PHI 7 ngày, còn đủ thời gian.\n\nPha 50g cho bình 16L."
        cleaned = post_filter_response(
            safe, 10, had_phi_violation=True,
            blocked_medicines=[{"name": "Thuốc trừ nấm Score 250EC", "active_ingredient": "Difenoconazole 250g/L"}],
            allowed_medicines=[{"name": "Ridomil Gold 68WG", "active_ingredient": "Metalaxyl-M + Mancozeb"}]
        )
        self.assertIn("Ridomil", cleaned, "Thuốc còn đủ thời gian cách ly không được bị gỡ")
        self.assertIn("Pha 50g", cleaned)
        self.assertNotIn("toàn bộ", cleaned)
        self.assertEqual(post_filter_response(safe, 30), safe, "Câu trả lời an toàn phải giữ nguyên định dạng")

    def test_harvest_days_parsed_from_vietnamese_phrases(self):
        expected = {
            "2 ngày nữa thu hoạch": 2,
            "chỉ còn 2 ngày nữa là thu hoạch": 2,
            "thu hoạch sau 3 ngày": 3,
            "hai ngày nữa thu hoạch": 2,
            "ngày mai thu hoạch": 1,
            "hôm nay hái": 0,
            "1 tuần nữa thu hoạch": 7,
            "cây 30 ngày tuổi, 2 ngày nữa thu hoạch": 2,
            "lá bị đốm 3 ngày nay": None
        }
        for text, days in expected.items():
            self.assertEqual(extract_harvest_days_from_text(text), days, text)

    def test_llm_only_sees_filtered_medicines_and_form_cannot_override_chat(self):
        resp, sent, _ = run_agent(
            [gemini_reply(tool_call("query_pesticide_store", disease_code="Tomato___Late_blight")),
             gemini_reply(MockPart(text="Bạn pha Ridomil Gold 50g, phun ngay."))],
            message="Cà chua còn 2 ngày nữa là thu hoạch",
            harvest_days_left=30
        )
        tool_turn = str(sent[1][-1])
        self.assertNotIn("Ridomil", tool_turn, "LLM không được thấy thuốc đã bị lọc")
        self.assertNotIn("Score", tool_turn)
        self.assertIn("Trichoderma", tool_turn)
        self.assertNotIn("Ridomil", resp.final_answer)
        self.assertEqual(resp.guardrail_triggered, HARVEST_BEFORE_PHI_VIOLATION)
        self.assertEqual([s.status for s in resp.steps if s.type == "guardrail_check"], ["BLOCKED_CHEMICAL_PESTICIDE"])

    def test_every_function_call_gets_a_response_and_total_calls_are_capped(self):
        weather = lambda t, a: MCPCallResponse(tool=t, result={"location": "Hà Nam", "is_rain": False, "risk_level": "LOW"})
        burst = gemini_reply(*[tool_call("check_weather_risk", location="Hà Nam") for _ in range(50)])
        resp, sent, tool_calls = run_agent([burst], tool=weather, harvest_days_left=30)
        self.assertLessEqual(tool_calls, MAX_TOTAL_TOOL_CALLS)
        self.assertEqual(len(sent), 5, "Vòng lặp phải dừng sau đúng 5 lượt Gemini")
        for contents in sent[1:]:
            self.assertEqual(len(contents[-2].parts), len(contents[-1]["parts"]), "Mỗi function_call phải có một function_response")
        self.assertIn("Kỹ sư nông nghiệp", resp.final_answer)
        self.assertNotIn("Không có thuốc", resp.final_answer, "Chưa tra kho thì không được kết luận về thuốc")

    def test_invalid_store_call_is_not_reported_as_safe(self):
        invalid = lambda t, a: MCPCallResponse(tool=t, is_error=True, result=None, error_code="INVALID_INPUT", error_message="bad")
        resp, _, _ = run_agent(
            [gemini_reply(tool_call("query_pesticide_store", disease_code="X")), gemini_reply(MockPart(text="Chưa tra được."))],
            tool=invalid, harvest_days_left=30
        )
        self.assertEqual([s for s in resp.steps if s.status == "PERMITTED"], [])

    def test_core_outage_opens_breaker_and_saves_gemini_quota(self):
        down = lambda t, a: MCPCallResponse(tool=t, is_error=True, result=None, error_code="UPSTREAM_UNAVAILABLE", error_message="down")
        reply = gemini_reply(tool_call("query_pesticide_store", disease_code="X"))
        llm = MagicMock(return_value=reply)
        with patch("app.agent.react_agent.gemini_client.call_react_turn", llm), \
                patch("app.agent.react_agent.gemini_client.is_available", return_value=True), \
                patch("app.agent.react_agent.mcp_server.call_tool", side_effect=down):
            for _ in range(6):
                resp = ReActAgent().run(message="x", harvest_days_left=30)
                self.assertTrue(resp.is_offline_fallback)
        self.assertEqual(circuit_breaker.state, CircuitState.OPEN)
        self.assertEqual(llm.call_count, 3)

    def test_failures_become_offline_answer_without_leaking_details(self):
        secret = RuntimeError("503 host=10.0.0.1 key=abc")
        resp, _, _ = run_agent([secret], harvest_days_left=30)
        self.assertTrue(resp.is_offline_fallback)
        self.assertNotIn("10.0.0.1", str(resp.to_dict()))

        for empty in (MagicMock(candidates=[]), MagicMock(candidates=[MagicMock(content=MockCandidateContent(None))])):
            resp, _, _ = run_agent([empty], harvest_days_left=30)
            self.assertTrue(resp.is_offline_fallback)

        with patch("app.agent.react_agent.mcp_server.to_gemini_declarations", side_effect=ValueError("boom")):
            resp, _, _ = run_agent([gemini_reply(MockPart(text="x"))], harvest_days_left=30)
        self.assertTrue(resp.is_offline_fallback)

    def test_breaker_classifies_errors_and_recovers_from_stuck_probe(self):
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=0.1)
        cb.record_failure(ConnectionError("Core at port 8400 down"))
        cb.record_failure(TimeoutError("timeout after 4000ms"))
        self.assertEqual(cb.consecutive_failures, 2, "Số 400 nằm trong chuỗi khác không phải lỗi 400")
        cb.record_failure(ConnectionError("down"))
        self.assertEqual(cb.state, CircuitState.OPEN)
        time.sleep(0.12)
        self.assertTrue(cb.can_execute())
        self.assertFalse(cb.can_execute())
        time.sleep(0.12)
        self.assertTrue(cb.can_execute(), "Lượt thăm dò không báo kết quả không được làm kẹt Circuit Breaker")

    def test_dosage_must_come_from_a_source(self):
        resp, _, _ = run_agent([gemini_reply(MockPart(text="Bạn pha Trichoderma 30g cho bình 16L."))], harvest_days_left=30)
        self.assertNotIn("30g", resp.final_answer)
        self.assertEqual(strip_unsourced_dosage("Pha 30g cho bình 16L.", ["Pha 30g cho bình 16L nước"]), "Pha 30g cho bình 16L.")
        resp, _, _ = run_agent(
            [gemini_reply(tool_call("query_pesticide_store", disease_code="Tomato___Late_blight")),
             gemini_reply(MockPart(text="Bạn pha Trichoderma 30g cho bình 16L."))],
            harvest_days_left=2
        )
        self.assertIn("30g", resp.final_answer, "Liều lượng lấy từ kho thuốc đã lọc phải được giữ")

    def test_gemini_timeout_is_in_milliseconds(self):
        # SDK google-genai tính timeout theo mili giây: để 30 sẽ làm mọi lời gọi thật hết giờ
        self.assertGreaterEqual(GEMINI_TIMEOUT_MS, 10_000)

    def test_text_parts_are_joined_without_breaking_words(self):
        resp, _, _ = run_agent([gemini_reply(MockPart(text="**Lo"), MockPart(text="ại:** Sinh học"))], harvest_days_left=30)
        self.assertIn("**Loại:** Sinh học", resp.final_answer)

    def test_active_ingredient_concentration_is_not_treated_as_unsourced_dose(self):
        resp, _, _ = run_agent(
            [gemini_reply(tool_call("query_pesticide_store", disease_code="Tomato___Late_blight")),
             gemini_reply(MockPart(text="Ridomil Gold (Metalaxyl-M 40g/kg) pha 50g cho bình 16L, PHI 7 ngày."))],
            harvest_days_left=30
        )
        self.assertIn("Ridomil Gold (Metalaxyl-M 40g/kg) pha 50g", resp.final_answer)

    def test_history_uses_gemini_roles_and_answers_hide_full_text(self):
        citation = {"source_id": "s1", "source_title": "t", "organization": "o", "source_url": "u", "excerpt": "e", "full_text": "toàn văn", "unit_type": "SUMMARY", "is_verbatim": False}
        lookup = lambda t, a: MCPCallResponse(tool=t, result={"disease_code": "X", "disease_name": "Y", "total_found": 2, "citations": [citation, citation]})
        conv_id = f"conv-{uuid.uuid4().hex[:8]}"
        replies = [gemini_reply(tool_call("lookup_disease_knowledge", disease_code="X")), gemini_reply(MockPart(text="Trả lời."))]
        resp, _, _ = run_agent(replies, tool=lookup, conversation_id=conv_id, harvest_days_left=30)
        public = resp.to_dict()["citations"]
        self.assertEqual(len(public), 1, "Trùng nguồn thì chỉ giữ một trích dẫn")
        self.assertNotIn("full_text", public[0])

        _, sent, _ = run_agent([gemini_reply(MockPart(text="Tiếp."))], conversation_id=conv_id, harvest_days_left=30)
        self.assertEqual([turn["role"] for turn in sent[0]], ["user", "model", "user"])

    def test_offline_never_guesses_and_states_facts_correctly(self):
        with tempfile.TemporaryDirectory() as tmp:
            cache_path = Path(tmp) / "cache.json"
            cache_path.write_text(json.dumps(build_offline_cache(from_seed=True), ensure_ascii=False), encoding="utf-8")
            router = OfflineRouter(cache_path=cache_path)

        self.assertEqual(router.get_offline_solution("Apple___Black_rot", 30, "cà chua mốc sương")["citations"], [])
        self.assertEqual(router.get_offline_solution(None, 30, "lá mận vẫn ngon nhưng bị gỉ sắt")["citations"], [])
        self.assertNotIn("0 ngày tới", router.get_offline_solution(None, None, "cây mít bị bệnh")["final_answer"])

        unknown = router.get_offline_solution("Tomato___Late_blight", None, "x")
        self.assertIn("Chưa rõ ngày thu hoạch", unknown["final_answer"])
        self.assertEqual(unknown["guardrail_triggered"], HARVEST_BEFORE_PHI_VIOLATION)

        partial = router.get_offline_solution("Tomato___Early_blight", 10, "x")["final_answer"]
        self.assertIn("Antracol", partial, "PHI 7 < 10 ngày: vẫn được dùng")
        self.assertNotIn("Score", partial, "PHI 14 >= 10 ngày: phải bị chặn")

        no_chem = router.get_offline_solution("Tomato___Target_Spot", 30, "x")["final_answer"]
        self.assertNotIn("KHÔNG SỬ DỤNG THUỐC HÓA HỌC", no_chem, "Còn 30 ngày thì không được nói là vi phạm PHI")


if __name__ == "__main__":
    unittest.main()
