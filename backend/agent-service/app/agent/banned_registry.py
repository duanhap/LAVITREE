"""
Danh mục chất cấm cho Lavi (TASK-19).

Nguồn: Core API GET /api/v1/banned-substances (bảng BannedSubstances, Admin cập nhật theo thông tư mới,
kể cả bỏ cấm). Bộ nhớ đệm 5 phút. Core lỗi thì giữ danh sách nạp được lần trước; chưa nạp được lần nào thì
dùng FALLBACK_TERMS (trùng dữ liệu khởi tạo của migration AddBannedSubstances), tức là thà chặn nhầm còn hơn bỏ lọt.
"""
import logging
import os
import threading
import time
from typing import Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger("agent.banned_registry")

CACHE_SECONDS = 300
FETCH_TIMEOUT_SECONDS = 3.0

# (cụm so khớp chữ thường, tên chung). Sinh từ cùng nguồn với Core (BannedSubstanceRegistry.Fallback) và web.
FALLBACK_TERMS: List[Tuple[str, str]] = [
    ("aldrin", "Aldrin"),
    ("lindane", "Lindane"),
    ("bhc", "Lindane"),
    ("cadmium compound", "Cadmium compound"),
    ("cadmium", "Cadmium compound"),
    ("carbofuran", "Carbofuran"),
    ("furadan", "Carbofuran"),
    ("chlordane", "Chlordane"),
    ("chlordimeform", "Chlordimeform"),
    ("ddt", "DDT"),
    ("dieldrin", "Dieldrin"),
    ("endosulfan", "Endosulfan"),
    ("thiodan", "Endosulfan"),
    ("endrin", "Endrin"),
    ("heptachlor", "Heptachlor"),
    ("isobenzan", "Isobenzan"),
    ("isodrin", "Isodrin"),
    ("lead (pb)", "Lead (Pb)"),
    ("methamidophos", "Methamidophos"),
    ("methyl parathion", "Methyl Parathion"),
    ("parathion-methyl", "Methyl Parathion"),
    ("monocrotophos", "Monocrotophos"),
    ("parathion ethyl", "Parathion Ethyl"),
    ("parathion", "Parathion Ethyl"),
    ("ethyl parathion", "Parathion Ethyl"),
    ("sodium pentachlorophenate monohydrate", "Sodium Pentachlorophenate monohydrate"),
    ("pentachlorophenol", "Pentachlorophenol"),
    ("phosphamidon", "Phosphamidon"),
    ("polychlorocamphene", "Polychlorocamphene"),
    ("toxaphene", "Polychlorocamphene"),
    ("trichlorfon", "Trichlorfon"),
    ("chlorophos", "Trichlorfon"),
    ("dipterex", "Trichlorfon"),
    ("arsenic (as)", "Arsenic (As)"),
    ("arsenic", "Arsenic (As)"),
    ("captan", "Captan"),
    ("captafol", "Captafol"),
    ("hexachlorobenzene", "Hexachlorobenzene"),
    ("mercury (hg)", "Mercury (Hg)"),
    ("mercury", "Mercury (Hg)"),
    ("selenium (se)", "Selenium (Se)"),
    ("thallium compound", "Thallium compound"),
    ("talium compond", "Thallium compound"),
    ("thallium", "Thallium compound"),
    ("2,4,5-t", "2,4,5-T"),
    ("2.4.5-t", "2,4,5-T"),
    ("paraquat", "Paraquat"),
    ("pa-ra-quat", "Paraquat"),
    ("para-quat", "Paraquat"),
    ("gramoxone", "Paraquat"),
    ("2,4-d", "2,4-D"),
    ("2.4-d", "2,4-D"),
    ("2,4d", "2,4-D"),
    ("2.4d", "2,4-D"),
    ("chlorpyrifos", "Chlorpyrifos"),
    ("glyphosate", "Glyphosate"),
]

_lock = threading.Lock()
_terms: List[Tuple[str, str]] = list(FALLBACK_TERMS)
_legal: Dict[str, str] = {}
_loaded_at: float = 0.0
_last_attempt: float = 0.0
_from_core: bool = False


def _fetch() -> Optional[Tuple[List[Tuple[str, str]], Dict[str, str]]]:
    base = (os.environ.get("CORE_API_URL") or "http://core-api:8080").rstrip("/")
    secret = os.environ.get("INTERNAL_API_SECRET")
    headers = {"X-Internal-Key": secret} if secret else {}
    try:
        resp = httpx.get(f"{base}/api/v1/banned-substances", headers=headers, timeout=FETCH_TIMEOUT_SECONDS)
        if resp.status_code != 200:
            logger.warning(f"Core banned-substances trả HTTP {resp.status_code}, giữ danh sách cũ")
            return None
        data = resp.json()
        raw_terms = data.get("terms")
        raw_items = data.get("items")
        if not isinstance(raw_terms, list) or not isinstance(raw_items, list):
            logger.warning("Core banned-substances trả dữ liệu sai dạng, giữ danh sách cũ")
            return None
        terms = [
            (str(t["text"]).strip().lower(), str(t["substance"]))
            for t in raw_terms
            if isinstance(t, dict) and t.get("text") and t.get("substance")
        ]
        legal = {
            str(i.get("common_name")): str(i.get("current_legal_document") or "")
            for i in raw_items
            if isinstance(i, dict) and i.get("is_banned")
        }
        return terms, legal
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
        logger.warning(f"Không tải được danh mục chất cấm từ Core ({type(e).__name__}), giữ danh sách cũ")
        return None


def _refresh_if_stale() -> None:
    global _terms, _legal, _loaded_at, _last_attempt, _from_core
    now = time.monotonic()
    # Thử lại tối đa mỗi CACHE_SECONDS, kể cả khi lần trước lỗi (không gọi Core ở mọi câu trả lời)
    if _last_attempt and now - _last_attempt < CACHE_SECONDS:
        return
    with _lock:
        if _last_attempt and now - _last_attempt < CACHE_SECONDS:
            return
        _last_attempt = now
        result = _fetch()
        if result is not None:
            _terms, _legal = result
            _loaded_at = now
            _from_core = True


def get_banned_entries() -> List[Tuple[str, str]]:
    """Danh sách (cụm so khớp, tên chung) đang bị cấm."""
    _refresh_if_stale()
    return list(_terms)


def get_banned_terms() -> List[str]:
    return [t for t, _ in get_banned_entries()]


def legal_basis(substance: str) -> str:
    """Số hiệu văn bản đang làm căn cứ cấm (rỗng nếu chưa biết)."""
    _refresh_if_stale()
    return _legal.get(substance, "")


def status() -> Dict[str, object]:
    return {"from_core": _from_core, "term_count": len(_terms), "loaded_at": _loaded_at}


def _reset_for_tests(terms: Optional[List[Tuple[str, str]]] = None, legal: Optional[Dict[str, str]] = None) -> None:
    """Chỉ dùng trong test: đặt danh sách cố định và không gọi Core."""
    global _terms, _legal, _last_attempt, _from_core
    with _lock:
        _terms = list(terms if terms is not None else FALLBACK_TERMS)
        _legal = dict(legal or {})
        _last_attempt = time.monotonic() + 10**9
        _from_core = False
