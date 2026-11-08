import re
import logging
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple

logger = logging.getLogger("agent.guardrails")

DRAFT_RECOMMENDATION_TAG = "[DRAFT_RECOMMENDATION]"
HARVEST_BEFORE_PHI_VIOLATION = "HARVEST_BEFORE_PHI_VIOLATION"
PHI_WARNING_TITLE = "⛔ NGUY CƠ TỒN DƯ THUỐC BVTV"

# Danh mục hoạt chất và tên thương phẩm thuốc BVTV bị cấm tại Việt Nam
# NGUỒN:
# - Danh mục thuốc BVTV cấm sử dụng tại Việt Nam, Thông tư 75/2025/TT-BNNMT (Bộ Nông nghiệp và Môi trường, ký 26/12/2025),
#   sửa đổi bởi Thông tư 28/2026/TT-BNNMT (hiệu lực 15/8/2026). Văn bản gốc: ppd.gov.vn, thuvienphapluat.vn.
# - Paraquat và 2,4-D: Quyết định 278/QĐ-BNN-BVTV (2017) loại khỏi danh mục được phép.
# - Chưa đối chiếu từng dòng của danh sách này với phụ lục của TT 75/2025 (xem BUG-93).
BANNED_INGREDIENTS = [
    "paraquat",
    "pa-ra-quat",
    "para-quat",
    "gramoxone",
    "2,4-d",
    "2.4-d",
    "2,4d",
    "2.4d",
    "chlorpyrifos",
    "carbofuran",
    "glyphosate",
    "monocrotophos",
    "methamidophos",
    "endosulfan"
]

# Danh mục các thuốc/hoạt chất hóa học thông dụng và thời gian cách ly tối thiểu (PHI chuẩn)
# NGUỒN (CHƯA ĐỦ, xem BUG-51/BUG-93):
# - Danh mục được phép của TT 75/2025/TT-BNNMT chỉ xác nhận thuốc được lưu hành; văn bản này KHÔNG quy định số ngày cách ly.
# - Thời gian cách ly (PHI) ghi trên nhãn đã đăng ký của từng sản phẩm. Các con số dưới đây CHƯA đối chiếu với nhãn
#   và chưa có kỹ sư nông nghiệp xác nhận; phải ghi là giới hạn trong báo cáo đồ án cho tới khi đối chiếu xong.
CHEMICAL_PESTICIDES_PHI = {
    "ridomil": 7,
    "antracol": 7,
    "score": 14,
    "aliette": 14,
    "mancozeb": 7,
    "metalaxyl": 7,
    "propineb": 7,
    "difenoconazole": 14,
    "chlorothalonil": 7,
    "azoxystrobin": 7,
    "kasumin": 7,
    "copper": 7,
    "gốc đồng": 7,
    "đồng đỏ": 7,
    "hexaconazole": 14,
    "validamycin": 7,
    "carbendazim": 14
}

# Thuốc hóa học hay gặp trong tài liệu nhưng chưa có PHI kiểm chứng trong kho: lấy mức cách ly lớn nhất của bảng trên (14 ngày)
# Đây là lựa chọn thiết kế của nhóm (mặc định an toàn), không phải quy định của văn bản nào: thuốc chưa rõ PHI
# thì cảnh báo theo mức dài nhất trong bảng trên.
UNVERIFIED_PHI_DAYS = max(CHEMICAL_PESTICIDES_PHI.values())
UNVERIFIED_CHEMICALS = [
    "daconil", "dithane", "amistar", "topsin", "thiophanate", "zineb", "cymoxanil", "dimethomorph",
    "tebuconazole", "propiconazole", "kocide", "streptomycin", "kasugamycin", "imidacloprid"
]

# Từ chung trong tên sản phẩm, không dùng để nhận diện một loại thuốc cụ thể
_GENERIC_NAME_WORDS = {
    "thuốc", "chế", "phẩm", "sinh", "học", "hóa", "chất", "nấm", "bệnh", "cỏ", "cấm", "gold", "bvtv", "dùng", "cũ"
}
_DOSE_PATTERN = re.compile(
    r"(?<![\w.,])\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*(?:gram|gam|gr|g|kg|ml|cc|lít|lit|l|nắp|gói|thìa)(?!\w)",
    re.IGNORECASE
)
_BIOLOGICAL_PATTERN = re.compile(r"trichoderma|bacillus|sinh học|vi sinh", re.IGNORECASE)


def _contains_term(text: str, term: str) -> bool:
    return re.search(rf"(?<!\w){re.escape(term)}(?!\w)", text, re.IGNORECASE) is not None


def _medicine_terms(medicine: Dict[str, Any]) -> Set[str]:
    """Các cách gọi của một thuốc: tên đầy đủ, từ đặc trưng trong tên và từng hoạt chất."""
    name = str(medicine.get("name") or medicine.get("product_name") or "").strip().lower()
    terms = {name} if name else set()
    terms.update(
        word for word in re.findall(r"[^\W\d_][\w-]*", name)
        if len(word) >= 4 and word not in _GENERIC_NAME_WORDS
    )
    for ingredient in str(medicine.get("active_ingredient", "")).split("+"):
        words = ingredient.strip().lower().split()
        if words and len(words[0]) >= 4:
            terms.add(words[0])
            terms.add(words[0].split("-")[0])
    return terms


def _split_segments(line: str) -> List[str]:
    # Chỉ tách câu khi có khoảng trắng sau dấu câu để giữ nguyên số thập phân như "0.5 kg"
    return re.split(r"(?<=[.!?;])\s+", line)


def _remove_flagged_segments(text: str, should_remove: Callable[[str], bool]) -> str:
    kept_lines = []
    for line in text.splitlines():
        kept = [seg for seg in _split_segments(line) if not should_remove(seg)]
        kept_line = " ".join(kept).strip()
        if re.search(r"\w", kept_line):
            kept_lines.append(kept_line)
    return "\n".join(kept_lines)


def strip_unsourced_dosage(response_text: str, evidence_texts: Iterable[str]) -> str:
    """Bỏ các câu nêu liều lượng không xuất hiện trong nguồn đã tra (tài liệu, kho thuốc hoặc lượt trước)."""
    evidence = re.sub(r"\s+", "", " ".join(evidence_texts)).lower()

    def is_unsourced(segment: str) -> bool:
        return any(
            re.sub(r"\s+", "", match.group(0)).lower() not in evidence
            for match in _DOSE_PATTERN.finditer(segment)
        )

    if not any(is_unsourced(seg) for line in response_text.splitlines() for seg in _split_segments(line)):
        return response_text

    cleaned = _remove_flagged_segments(response_text, is_unsourced)
    return (
        f"{cleaned}\n\n⚠️ Đã lược bỏ liều lượng chưa có nguồn kiểm chứng. "
        "Hãy đọc nhãn thuốc hoặc hỏi Kỹ sư nông nghiệp trước khi pha."
    )


def pre_filter_medicines(
    medicines: List[Dict[str, Any]],
    harvest_days_left: Optional[int]
) -> Tuple[List[Dict[str, Any]], bool, List[str]]:
    """
    Chốt chặn tiền lọc bằng Code (Hard Pre-Filter - Không phụ thuộc LLM):
    1. Lọc sạch thuốc cấm (is_allowed = false hoặc tên/hoạt chất thuộc danh mục cấm).
    2. Nếu harvest_days_left is None: mặc định giả định harvest_days_left = 0
       (kịch bản bảo thủ tối đa -> chặn toàn bộ thuốc hóa học, chỉ cho phép sinh học).
    3. Loại bỏ thuốc hóa học nếu phi_days >= harvest_days_left (vi phạm thời gian cách ly).
    
    Returns:
        (filtered_medicines, had_phi_violation, blocked_reasons)
    """
    effective_harvest_days = 0 if harvest_days_left is None else harvest_days_left
    had_phi_violation = False
    blocked_reasons: List[str] = []
    filtered: List[Dict[str, Any]] = []

    for med in medicines:
        name = str(med.get("name") or med.get("product_name") or "").strip()
        active_ing = str(med.get("active_ingredient", "")).strip().lower()
        name_lower = name.lower()
        # Thiếu dữ liệu an toàn thì coi như không an toàn (fail-closed)
        is_allowed = bool(med.get("is_allowed", False))
        raw_phi_days = med.get("phi_days")
        medicine_type = str(med.get("medicine_type", "Hóa học")).strip()

        # 1. Kiểm tra thuốc cấm (quét cả tên thương phẩm lẫn hoạt chất)
        is_banned = (
            not is_allowed
            or any(banned in active_ing for banned in BANNED_INGREDIENTS)
            or any(banned in name_lower for banned in BANNED_INGREDIENTS)
        )
        if is_banned:
            reason = f"Thuốc '{name}' bị chặn vì thuộc danh mục hóa chất cấm lưu hành tại Việt Nam."
            logger.warning(f"[Guardrail] {reason}")
            blocked_reasons.append(reason)
            continue

        # 2. Kiểm tra an toàn thời gian cách ly (PHI)
        # Chỉ chế phẩm sinh học PHI=0 mới dùng được khi không rõ ngày thu hoạch hoặc thu hoạch ngay
        phi_days = 999 if raw_phi_days is None else int(raw_phi_days)
        is_safe_biological = medicine_type.lower() == "sinh học" and phi_days == 0
        if not is_safe_biological and (harvest_days_left is None or effective_harvest_days <= phi_days):
            had_phi_violation = True
            days_label = "chưa rõ" if harvest_days_left is None else f"{effective_harvest_days} ngày"
            reason = (
                f"Thuốc '{name}' (PHI = {phi_days} ngày) bị chặn vì vi phạm thời gian cách ly "
                f"(ngày thu hoạch còn lại: {days_label})."
            )
            logger.warning(f"[Guardrail] {reason}")
            blocked_reasons.append(reason)
            continue

        # Thuốc an toàn (Sinh học PHI=0 hoặc thuốc đáp ứng đủ thời gian cách ly)
        filtered.append(med)

    return filtered, had_phi_violation, blocked_reasons


def post_filter_response(
    response_text: str,
    harvest_days_left: Optional[int],
    had_phi_violation: bool = False,
    blocked_medicines: Optional[List[Dict[str, Any]]] = None,
    allowed_medicines: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Chốt chặn hậu kiểm bằng Code (Hard Post-Filter):
    Đối chiếu văn bản của LLM với danh mục thuốc cấm, danh mục PHI và kết quả tiền lọc của kho thuốc.
    PHI của kho (allowed/blocked) được ưu tiên hơn danh mục PHI viết sẵn.
    Nếu phát hiện vi phạm:
    - Gỡ câu nhắc thuốc vi phạm và các câu liều lượng hóa học còn sót lại.
    - Chèn cảnh báo đỏ: ⛔ NGUY CƠ TỒN DƯ THUỐC BVTV.
    - Bổ sung hướng dẫn sinh học thay thế an toàn.
    """
    effective_harvest_days = 0 if harvest_days_left is None else harvest_days_left

    allowed_terms = {term for med in (allowed_medicines or []) for term in _medicine_terms(med)}
    phi_terms = {term for med in (blocked_medicines or []) for term in _medicine_terms(med)}
    phi_terms.update(
        chem_name for chem_name, min_phi in CHEMICAL_PESTICIDES_PHI.items()
        if effective_harvest_days <= min_phi
    )
    if effective_harvest_days <= UNVERIFIED_PHI_DAYS:
        phi_terms.update(UNVERIFIED_CHEMICALS)
    phi_terms -= allowed_terms

    banned_detected = any(_contains_term(response_text, term) for term in BANNED_INGREDIENTS)
    phi_detected = any(_contains_term(response_text, term) for term in phi_terms)
    forbidden_terms = phi_terms | set(BANNED_INGREDIENTS)

    modified_text = response_text
    if banned_detected or phi_detected:
        modified_text = _remove_flagged_segments(
            modified_text,
            lambda seg: any(_contains_term(seg, term) for term in forbidden_terms)
        )
        # Câu liều lượng đứng riêng ("Pha 50g cho bình 16L") vẫn là đơn thuốc hóa học vừa bị gỡ
        modified_text = _remove_flagged_segments(
            modified_text,
            lambda seg: _DOSE_PATTERN.search(seg) is not None
            and not _BIOLOGICAL_PATTERN.search(seg)
            and not any(_contains_term(seg, term) for term in allowed_terms)
        )

    warning_blocks = []

    if banned_detected:
        # Không lặp lại tên hoạt chất cấm trong câu cảnh báo
        warning_blocks.append(
            "⛔ CẢNH BÁO AN TOÀN BẢO VỆ THỰC VẬT: Hệ thống đã gỡ đề xuất có hoạt chất bị cấm "
            "theo quy định của Cục Trồng trọt & BVTV. Tuyệt đối không sử dụng."
        )

    if phi_detected or had_phi_violation:
        harvest_label = (
            "Chưa rõ ngày thu hoạch nên hệ thống áp dụng mức an toàn cao nhất."
            if harvest_days_left is None
            else f"Nông sản dự kiến thu hoạch trong {effective_harvest_days} ngày tới."
        )
        warning_blocks.append(
            f"{PHI_WARNING_TITLE} (VI PHẠM THỜI GIAN CÁCH LY PHI):\n"
            f"{harvest_label} "
            f"Hệ thống đã loại các đề xuất thuốc có thời gian cách ly không kịp trước ngày thu hoạch.\n"
            f"🌿 GIẢI PHÁP AN TOÀN THAY THẾ:\n"
            f"- Cắt tỉa, thu gom và tiêu hủy ngay các lá/cành/quả bị nhiễm bệnh để tránh lây lan.\n"
            f"- Chỉ dùng chế phẩm sinh học có thời gian cách ly 0 ngày (ví dụ Trichoderma, Bacillus subtilis) "
            f"hoặc thu hoạch sớm nếu nông sản đã đạt độ chín thương phẩm."
        )

    if warning_blocks:
        modified_text = "\n\n".join(block for block in [modified_text, *warning_blocks] if block)

    return modified_text


def apply_hitl_tag(response_text: str) -> str:
    """
    Đảm bảo 100% các khuyến nghị chuyên môn của Agent đều mang nhãn
    [DRAFT_RECOMMENDATION] theo nguyên tắc Human-in-the-Loop.
    """
    text = response_text.strip()
    if text.startswith(DRAFT_RECOMMENDATION_TAG):
        return text
    return f"{DRAFT_RECOMMENDATION_TAG} {text}"
