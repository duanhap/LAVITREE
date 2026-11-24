"""Unit tests cho TASK-25: Rich Cards (Ảnh triệu chứng & Thẻ gợi ý sản phẩm)."""

import pytest
from app.agent.product_cards import build_suggested_products


def test_product_cards_no_price_and_safe_matching():
    catalog = [
        {
            "id": 1,
            "name": "Ridomil Gold 68WG",
            "active_ingredient": "Mancozeb 64% + Metalaxyl-M 4%",
            "medicine_type": "Hóa học",
            "phi_days": 7,
            "availability": "IN_STOCK",
            "price": 65000,  # Không được lọt vào thẻ gợi ý theo BUG-106 / TASK-25
        },
        {
            "id": 2,
            "name": "Chế phẩm Trichoderma",
            "active_ingredient": "Trichoderma spp.",
            "medicine_type": "Sinh học",
            "phi_days": 0,
            "availability": "IN_STOCK",
            "price": 45000,
        },
    ]

    # 1. Answer chỉ nhắc Ridomil Gold
    answer = "Bác nên sử dụng Ridomil Gold để trị nấm."
    cards = build_suggested_products(answer, catalog, is_fallback_catalog=False, image_uncertain=False)
    assert len(cards) == 1
    assert cards[0]["product_id"] == 1
    assert cards[0]["product_name"] == "Ridomil Gold 68WG"
    assert "price" not in cards[0]  # Tuyệt đối không chứa price

    # 2. Nếu là catalog fallback (chưa kiểm tra hợp pháp) -> Trả về rỗng
    cards_fallback = build_suggested_products(answer, catalog, is_fallback_catalog=True, image_uncertain=False)
    assert len(cards_fallback) == 0

    # 3. Nếu chẩn đoán ảnh không chắc chắn (image_uncertain=True) -> Trả về rỗng
    cards_uncertain = build_suggested_products(answer, catalog, is_fallback_catalog=False, image_uncertain=True)
    assert len(cards_uncertain) == 0

    # 4. Nếu answer không nhắc gì đến sản phẩm nào -> Trả về rỗng
    cards_none = build_suggested_products("Cắt tỉa lá bệnh tiêu hủy xa vườn.", catalog, is_fallback_catalog=False)
    assert len(cards_none) == 0


# ---------------------------------------------------------------------------
# Bổ sung khi nghiệm thu TASK-25 (mục 11.4)
# ---------------------------------------------------------------------------
import pathlib
import re as _re

from pydantic import ValidationError

from app.mcp.client import _is_safe_image_url

_CLASSES_MD = pathlib.Path(__file__).resolve().parents[2] / "docs" / "spec" / "classes.md"


def _model_class_codes():
    text = _CLASSES_MD.read_text(encoding="utf-8")
    return _re.findall(r"^\| \d+ \| `([^`]+)` \|", text, flags=_re.MULTILINE)


def _image_context_model():
    from app.main import ImageContext
    return ImageContext


def test_image_context_accepts_all_38_model_classes():
    codes = _model_class_codes()
    assert len(codes) == 38
    ImageContext = _image_context_model()
    for code in codes:
        ImageContext(class_code=code, confidence=0.9)


@pytest.mark.parametrize("bad", [
    {"class_code": "Tomato___Late_blight", "confidence": 1.2},
    {"class_code": "<script>alert(1)</script>", "confidence": 0.5},
    {"class_code": "Tomato___Late_blight", "confidence": 0.5,
     "top3": [{"class_code": "A", "confidence": 0.1}] * 4},
])
def test_image_context_rejects_invalid(bad):
    ImageContext = _image_context_model()
    with pytest.raises(ValidationError):
        ImageContext(**bad)


@pytest.mark.parametrize("url,ok", [
    ("https://cdn.example.org/a.jpg", True),
    ("/lavitree-images/tomato/a.webp", True),
    ("http://localhost:9000/lavitree-images/a.jpg", True),
    ("http://evil.example.com/a.jpg", False),
    ("//evil.example.com/a.jpg", False),
    ("data:image/png;base64,AAAA", False),
    ("javascript:alert(1)", False),
    ("", False),
])
def test_reference_image_url_filter(url, ok):
    assert _is_safe_image_url(url) is ok


def test_product_cards_dedupe_max3_and_guardrail():
    catalog = [
        {"id": i, "name": f"Thuoc{i} 10SC", "availability": "IN_STOCK"} for i in range(1, 6)
    ] + [{"id": 1, "name": "Thuoc1 10SC", "availability": "IN_STOCK"},
         {"id": 9, "name": "KhongBan", "availability": "NOT_SOLD"}]
    answer = "Dùng Thuoc1, Thuoc2, Thuoc3, Thuoc4 hoặc KhongBan."
    cards = build_suggested_products(answer, catalog)
    assert [c["product_id"] for c in cards] == [1, 2, 3]
    assert build_suggested_products(answer, catalog, guardrail_blocked=True) == []
