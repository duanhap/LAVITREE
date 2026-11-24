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
