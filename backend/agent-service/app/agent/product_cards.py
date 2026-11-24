import re
from typing import Any, Dict, List, Optional


def _is_mentioned(name: str, active_ingredient: Optional[str], text_lower: str) -> bool:
    name_clean = name.strip().casefold()
    if not name_clean:
        return False
    if name_clean in text_lower:
        return True
    # Bỏ hậu tố dạng đóng gói / hàm lượng (ví dụ "68WG", "68WP", "400SC", "5SL")
    base_name = re.sub(r"\s+\d*[a-z]{2,5}(/[a-z]{2,5})?$", "", name_clean).strip()
    if len(base_name) >= 4 and base_name in text_lower:
        return True
    return False


def build_suggested_products(
    final_answer_text: str,
    allowed_medicines: List[Dict[str, Any]],
    *,
    is_fallback_catalog: bool = False,
    image_uncertain: bool = False,
    guardrail_blocked: bool = False
) -> List[Dict[str, Any]]:
    """
    Xây dựng danh sách thẻ gợi ý sản phẩm hiển thị trong giao diện chat.
    Ràng buộc an toàn:
    - Không trả thẻ nếu danh mục là fallback mock, ảnh chẩn đoán không chắc chắn, hoặc bị guardrail chặn.
    - Chỉ gợi ý các sản phẩm có tên thật sự được nhắc trong final_answer_text đã qua guardrail.
    - Tối đa 3 thẻ, không trùng lặp ID, không gửi kèm giá (giá lấy trực tiếp từ Core API).
    """
    if is_fallback_catalog or image_uncertain or guardrail_blocked:
        return []

    answer_lower = final_answer_text.casefold()
    seen = set()
    result: List[Dict[str, Any]] = []

    for med in allowed_medicines:
        pid = med.get("id")
        name = (med.get("name") or med.get("product_name") or "").strip()
        if pid is None or not name or pid in seen:
            continue
        if med.get("availability") == "NOT_SOLD":
            continue
        if not _is_mentioned(name, med.get("active_ingredient"), answer_lower):
            continue

        seen.add(pid)
        result.append({
            "product_id": pid,
            "product_name": name,
            "active_ingredient": med.get("active_ingredient") or "",
            "image_url": med.get("image_url") or "",
            "phi_days": med.get("phi_days"),
            "rain_resistant": bool(med.get("rain_resistant", False)),
            "availability": med.get("availability", "IN_STOCK"),
        })
        if len(result) >= 3:
            break

    return result
