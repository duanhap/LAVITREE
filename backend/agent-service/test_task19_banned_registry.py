"""TASK-19: danh mục chất cấm lấy từ Core (có bộ đệm, dự phòng) + Lavi nhắc nông dân khi họ hỏi về chất cấm."""
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx

from app.agent import banned_registry
from app.agent.guardrails import (
    find_banned_substances,
    post_filter_response,
    pre_filter_medicines,
)


def _core_response(terms, items):
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"terms": terms, "items": items}
    return resp


def _force_refresh():
    # Cho phép lần gọi kế tiếp tải lại từ Core
    banned_registry._last_attempt = 0.0


class BannedRegistryTests(unittest.TestCase):
    def tearDown(self):
        banned_registry._reset_for_tests()

    def test_fallback_when_core_unreachable(self):
        banned_registry._reset_for_tests()
        _force_refresh()
        with patch.object(banned_registry.httpx, "get", side_effect=httpx.ConnectError("down")):
            terms = banned_registry.get_banned_terms()
        self.assertIn("trichlorfon", terms)  # chất mới của Phụ lục II TT 75/2025
        self.assertIn("paraquat", terms)
        self.assertFalse(banned_registry.status()["from_core"])

    def test_loads_from_core_and_caches(self):
        banned_registry._reset_for_tests()
        _force_refresh()
        resp = _core_response(
            [{"text": "carbofuran", "substance": "Carbofuran"}, {"text": "furadan", "substance": "Carbofuran"}],
            [{"common_name": "Carbofuran", "is_banned": True, "current_legal_document": "Thông tư 75/2025/TT-BNNMT, Phụ lục II"}],
        )
        with patch.object(banned_registry.httpx, "get", return_value=resp) as get:
            self.assertEqual(banned_registry.get_banned_terms(), ["carbofuran", "furadan"])
            banned_registry.get_banned_terms()
            self.assertEqual(get.call_count, 1, "lần gọi thứ 2 trong 5 phút phải dùng bộ đệm")
        self.assertEqual(banned_registry.legal_basis("Carbofuran"), "Thông tư 75/2025/TT-BNNMT, Phụ lục II")

    def test_core_error_keeps_last_list(self):
        banned_registry._reset_for_tests([("captan", "Captan")])
        _force_refresh()
        bad = MagicMock(status_code=500)
        with patch.object(banned_registry.httpx, "get", return_value=bad):
            self.assertEqual(banned_registry.get_banned_terms(), ["captan"])


class GuardrailWithRegistryTests(unittest.TestCase):
    def tearDown(self):
        banned_registry._reset_for_tests()

    def test_unbanned_substance_no_longer_blocked(self):
        # Admin thêm quyết định Bỏ cấm Captan → Core không còn trả "captan"
        banned_registry._reset_for_tests([("carbofuran", "Carbofuran")])
        meds = [{"name": "Captan 50WP", "active_ingredient": "Captan", "is_allowed": True, "phi_days": 7, "medicine_type": "Hóa học"}]
        allowed, _, reasons = pre_filter_medicines(meds, harvest_days_left=30)
        self.assertEqual(len(allowed), 1, reasons)

    def test_newly_banned_substance_blocked(self):
        banned_registry._reset_for_tests([("trichlorfon", "Trichlorfon"), ("dipterex", "Trichlorfon")])
        meds = [{"name": "Dipterex 90SP", "active_ingredient": "Trichlorfon 90%", "is_allowed": True, "phi_days": 7, "medicine_type": "Hóa học"}]
        allowed, _, reasons = pre_filter_medicines(meds, harvest_days_left=30)
        self.assertEqual(allowed, [])
        self.assertTrue(reasons)

    def test_whole_word_matching(self):
        banned_registry._reset_for_tests([("2,4-d", "2,4-D")])
        self.assertEqual(find_banned_substances("Phun 2,4-D 720SL"), ["2,4-D"])
        self.assertEqual(find_banned_substances("Thuốc 2,4-DB khác hoạt chất"), [])

    def test_farmer_question_gets_named_warning(self):
        banned_registry._reset_for_tests(
            [("carbofuran", "Carbofuran"), ("furadan", "Carbofuran")],
            {"Carbofuran": "Thông tư 75/2025/TT-BNNMT, Phụ lục II"},
        )
        answer = "Bạn có thể rải Furadan 3GR quanh gốc, 2kg/sào. Ngoài ra nên vệ sinh đồng ruộng."
        out = post_filter_response(answer, harvest_days_left=30, user_query="Rải Furadan trị sâu đục thân được không?")
        self.assertNotIn("2kg/sào", out, "câu khuyên dùng chất cấm phải bị gỡ")
        self.assertIn("⛔ CHẤT CẤM: Carbofuran (Thông tư 75/2025/TT-BNNMT, Phụ lục II)", out)
        self.assertIn("vệ sinh đồng ruộng", out)

    def test_ai_mentions_banned_without_question_keeps_generic_warning(self):
        banned_registry._reset_for_tests([("carbofuran", "Carbofuran")])
        out = post_filter_response("Có thể dùng Carbofuran.", harvest_days_left=30, user_query="Sâu đục thân trị sao?")
        self.assertNotIn("Carbofuran", out)
        self.assertIn("Hệ thống đã gỡ đề xuất có hoạt chất bị cấm", out)

    def test_no_banned_no_warning(self):
        banned_registry._reset_for_tests([("carbofuran", "Carbofuran")])
        out = post_filter_response("Nên cắt tỉa lá bệnh.", harvest_days_left=30, user_query="Lá cà chua bị đốm")
        self.assertNotIn("⛔", out)


if __name__ == "__main__":
    unittest.main()
