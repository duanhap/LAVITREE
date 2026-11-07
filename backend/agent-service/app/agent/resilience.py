import json
import re
import time
import logging
import threading
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.agent.guardrails import (
    DRAFT_RECOMMENDATION_TAG,
    HARVEST_BEFORE_PHI_VIOLATION,
    apply_hitl_tag,
    pre_filter_medicines,
    post_filter_response
)

logger = logging.getLogger("agent.resilience")

CACHE_FILE_PATH = Path(__file__).resolve().parent / "offline_ipm_cache.json"


def _is_client_input_error(error: Optional[Exception]) -> bool:
    """Lỗi do input của một request (400/422), không phải sự cố hạ tầng dùng chung."""
    if error is None:
        return False
    if getattr(error, "code", None) in (400, 422):
        return True
    message = str(error).lower()
    return (
        re.search(r"(?:^|status\s+|code\s+|error\s+)(?:400|422)\b", message) is not None
        or "invalid_argument" in message
        or "validation" in message
    )


def _contains_word(text: str, word: str) -> bool:
    return re.search(rf"(?<!\w){re.escape(word)}(?!\w)", text) is not None


class CircuitState(str, Enum):
    CLOSED = "CLOSED"       # Bình thường, cho phép mọi request đi qua
    OPEN = "OPEN"           # Đang ngắt mạch, chặn request LLM và chuyển hướng offline
    HALF_OPEN = "HALF_OPEN" # Thử nghiệm 1 request sau thời gian hồi phục (cooldown)


class CircuitBreaker:
    """
    Circuit Breaker cho các dịch vụ ngoại vi (LLM Cloud, Weather API, Core API).
    Ngưỡng thất bại liên tiếp: 3 lần -> Chuyển sang OPEN.
    Thời gian hồi phục (Cooldown): 60 giây -> Chuyển sang HALF_OPEN thử 1 request.
    Đặc tính bảo vệ:
    - Bỏ qua lỗi 4xx (input validation của 1 người dùng không làm ngắt mạch cả hệ thống).
    - Chỉ cho phép đúng 1 request thăm dò khi ở trạng thái HALF_OPEN.
    Thread-safe.
    """
    def __init__(self, failure_threshold: int = 3, recovery_timeout: float = 60.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.state = CircuitState.CLOSED
        self.consecutive_failures = 0
        self.last_state_change = time.time()
        self._probing_in_flight = False
        self._lock = threading.Lock()

    def can_execute(self) -> bool:
        with self._lock:
            now = time.time()
            if self.state == CircuitState.CLOSED:
                return True
            if self.state == CircuitState.OPEN:
                if (now - self.last_state_change) >= self.recovery_timeout:
                    self.state = CircuitState.HALF_OPEN
                    self.last_state_change = now
                    self._probing_in_flight = True
                    logger.info("[CircuitBreaker] Cooldown elapsed. Switching state to HALF_OPEN (1 probe allowed).")
                    return True
                return False
            if self.state == CircuitState.HALF_OPEN:
                # Chỉ cho phép đúng 1 request thăm dò chạy cùng lúc.
                # Request thăm dò không báo kết quả quá lâu thì cho request khác thử, tránh kẹt mãi ở offline.
                probe_timed_out = (now - self.last_state_change) >= self.recovery_timeout
                if not self._probing_in_flight or probe_timed_out:
                    self._probing_in_flight = True
                    self.last_state_change = now
                    return True
                return False
            return False

    def record_success(self) -> None:
        with self._lock:
            if self.state != CircuitState.CLOSED:
                logger.info(f"[CircuitBreaker] Upstream call succeeded! Switching from {self.state} to CLOSED.")
            self.state = CircuitState.CLOSED
            self.consecutive_failures = 0
            self._probing_in_flight = False
            self.last_state_change = time.time()

    def record_failure(self, error: Optional[Exception] = None) -> None:
        with self._lock:
            # Lỗi 4xx do input người dùng không được tính vào sự cố hạ tầng của Circuit Breaker
            if _is_client_input_error(error):
                logger.warning(f"[CircuitBreaker] Ignored client 4xx error from circuit failure count: {error}")
                self._probing_in_flight = False
                return

            self.consecutive_failures += 1
            self._probing_in_flight = False
            logger.warning(
                f"[CircuitBreaker] Upstream infrastructure failure ({self.consecutive_failures}/{self.failure_threshold}). "
                f"Error: {error}"
            )
            if self.state == CircuitState.HALF_OPEN or self.consecutive_failures >= self.failure_threshold:
                self.state = CircuitState.OPEN
                self.last_state_change = time.time()
                logger.error(
                    f"[CircuitBreaker] Threshold reached. Circuit switched to OPEN. "
                    f"All requests will fallback to offline IPM cache for {self.recovery_timeout}s."
                )

    def reset(self) -> None:
        with self._lock:
            self.state = CircuitState.CLOSED
            self.consecutive_failures = 0
            self._probing_in_flight = False
            self.last_state_change = time.time()


class OfflineRouter:
    """
    Router hạ cấp ngoại tuyến (Graceful Degradation):
    Truy vấn trực tiếp tệp phác đồ tĩnh IPM lưu cục bộ (Local JSON Cache: offline_ipm_cache.json).
    Đặc tính bảo mật & an toàn:
    - Bắt buộc kiểm tra trùng khớp cả Cây trồng VÀ Bệnh hại (tuyệt đối không lấy phác đồ ngô trả cho cà phê).
    - Cắt bỏ hoàn toàn thuốc hóa học khi sát ngày thu hoạch.
    - Thời gian phản hồi < 500ms, kèm trích dẫn nguồn có kiểm định.
    """
    def __init__(self, cache_path: Path = CACHE_FILE_PATH):
        self._cache_path = cache_path
        self._cache_data: Dict[str, Any] = {}
        self._load_cache()

    def _load_cache(self) -> None:
        if not self._cache_path.exists():
            logger.warning(f"[OfflineRouter] Cache file not found at {self._cache_path}. Offline fallback will be limited.")
            self._cache_data = {}
            return
        try:
            with open(self._cache_path, "r", encoding="utf-8") as f:
                self._cache_data = json.load(f)
            logger.info(f"[OfflineRouter] Loaded offline IPM bundle for {len(self._cache_data)} diseases.")
        except Exception as e:
            logger.error(f"[OfflineRouter] Failed to load offline IPM bundle: {e}")
            self._cache_data = {}

    def get_offline_solution(
        self,
        disease_code: Optional[str],
        harvest_days_left: Optional[int],
        user_query: str
    ) -> Dict[str, Any]:
        """
        Tạo phác đồ điều trị IPM ngoại tuyến an toàn 100%, bảo toàn trích dẫn nguồn (citations).
        """
        start_time = time.perf_counter()
        effective_harvest_days = 0 if harvest_days_left is None else harvest_days_left
        citations: List[Dict[str, Any]] = []

        # 1. Tìm kiếm bệnh trong cache: Bắt buộc chuẩn xác về cả Cây VÀ Bệnh
        # Đã có mã bệnh từ chẩn đoán thì chỉ dùng đúng mã đó, không đoán theo câu chữ
        matched_disease = None
        if disease_code:
            matched_disease = self._cache_data.get(disease_code)
        else:
            q_lower = user_query.lower()

            # Phân tích cây trồng nhắc đến trong câu hỏi
            is_tomato = _contains_word(q_lower, "cà chua") or _contains_word(q_lower, "ca chua")
            is_pepper = _contains_word(q_lower, "ớt") or _contains_word(q_lower, "ot")
            is_corn = any(_contains_word(q_lower, word) for word in ("ngô", "bắp", "ngo", "bap"))

            # Nếu hỏi về cây trồng khác (cà phê, khoai tây, lúa, táo, v.v.), TUYỆT ĐỐI KHÔNG GÁN BẬY
            other_plants = ["cà phê", "ca phe", "khoai tây", "khoai tay", "lúa", "lua", "dưa", "dua", "táo", "tao", "nho"]
            has_other_plant = any(_contains_word(q_lower, op) for op in other_plants)

            if not has_other_plant:
                if is_tomato:
                    if "mốc sương" in q_lower or "sương mai" in q_lower:
                        matched_disease = self._cache_data.get("Tomato___Late_blight")
                    elif "đốm vòng" in q_lower or "cháy lá sớm" in q_lower:
                        matched_disease = self._cache_data.get("Tomato___Early_blight")
                    elif "đốm mục tiêu" in q_lower:
                        matched_disease = self._cache_data.get("Tomato___Target_Spot")
                elif is_pepper:
                    if "đốm vi khuẩn" in q_lower or "vi khuẩn" in q_lower or "mắt cua" in q_lower:
                        matched_disease = self._cache_data.get("Pepper,_bell___Bacterial_spot")
                elif is_corn:
                    if "gỉ sắt" in q_lower or "mụn mủ" in q_lower:
                        matched_disease = self._cache_data.get("Corn_(maize)___Common_rust_")

        if not matched_disease:
            # Fallback chung khi cây trồng hoặc bệnh hại ngoài danh mục 5 bệnh demo
            answer = (
                f"{DRAFT_RECOMMENDATION_TAG} [CHẾ ĐỘ NGOẠI TUYẾN - OFFLINE FALLBACK]\n"
                f"Hệ thống hiện đang hoạt động ở chế độ ngoại tuyến không có kết nối máy chủ.\n\n"
                f"👉 **Khuyến cáo quản lý dịch hại tổng hợp (IPM)**:\n"
                f"1. Vệ sinh đồng ruộng, cắt tỉa và gom các lá bị đốm nấm hoặc úng nước tiêu hủy xa vườn.\n"
                f"2. Tuyệt đối không tưới nước lên tán lá vào chiều tối để hạn chế độ ẩm phát tán nấm.\n"
                f"3. Ưu tiên sử dụng các chế phẩm sinh học đối kháng (Trichoderma, Bacillus) an toàn PHI = 0 ngày.\n"
                f"4. Nếu chưa rõ ngày thu hoạch hoặc sắp thu hoạch, tuyệt đối KHÔNG PHUN thuốc bảo vệ thực vật hóa học để tránh tồn dư độc hại.\n\n"
                f"⚠️ *Lưu ý: Để tra cứu phác đồ đặc trị chi tiết cho loại cây trồng này, vui lòng kết nối mạng để trợ lý AI tra cứu thư viện hoặc liên hệ Kỹ sư nông nghiệp.*"
            )
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            return {
                "disease_code": disease_code or "UNKNOWN",
                "final_answer": answer,
                "citations": [],
                "guardrail_triggered": HARVEST_BEFORE_PHI_VIOLATION if harvest_days_left is None else None,
                "is_offline_fallback": True,
                "execution_time_ms": round(elapsed_ms, 2)
            }

        disease_name = matched_disease.get("disease_name_vi", disease_code)
        citations = matched_disease.get("citations", [])
        actual_disease_code = matched_disease.get("disease_code", disease_code)

        # 2. Xây dựng nội dung phác đồ IPM
        lines = [
            f"{DRAFT_RECOMMENDATION_TAG} [CHẾ ĐỘ NGOẠI TUYẾN - PHÁC ĐỒ IPM ĐÃ KIỂM ĐỊNH]",
            f"**Cây trồng & Bệnh hại**: {matched_disease.get('plant_name', '')} - {disease_name}",
            f"**Tác nhân gây hại**: {matched_disease.get('pathogen', 'Nấm bệnh')}",
            "",
            "### 1. Biện pháp canh tác & cơ học (Bắt buộc):"
        ]
        for m in matched_disease.get("cultural_measures", []):
            lines.append(f"- {m}")

        bio_measures = matched_disease.get("biological_measures", [])
        if bio_measures:
            lines.append("\n### 2. Biện pháp sinh học (Ưu tiên hàng đầu - An toàn tuyệt đối):")
            for bio in bio_measures:
                lines.append(
                    f"- **{bio['product_name']}** ({bio['active_ingredient']}): {bio['dosage']} "
                    f"(Thời gian cách ly: {bio['phi_days']} ngày)."
                )

        # 3. Biện pháp hóa học có kiểm soát PHI
        chem_medicines = matched_disease.get("chemical_measures", [])
        filtered_chem, had_phi_violation, blocked_reasons = pre_filter_medicines(
            chem_medicines, harvest_days_left
        )

        lines.append("\n### 3. Biện pháp hóa học đặc trị:")
        if filtered_chem:
            for chem in filtered_chem:
                lines.append(
                    f"- **{chem['product_name']}** ({chem['active_ingredient']}): {chem['dosage']} "
                    f"(Thời gian cách ly: {chem['phi_days']} ngày)."
                )
        elif chem_medicines:
            harvest_label = (
                "Chưa rõ ngày thu hoạch"
                if harvest_days_left is None
                else f"Thời gian thu hoạch dự kiến còn {effective_harvest_days} ngày"
            )
            lines.append(
                f"⛔ **KHÔNG SỬ DỤNG THUỐC HÓA HỌC**: {harvest_label}, không đủ thời gian cách ly PHI của các loại thuốc hóa học. "
                f"Để đảm bảo an toàn vệ sinh thực phẩm và không tồn dư hóa chất, chỉ áp dụng biện pháp canh tác và chế phẩm sinh học."
            )
        else:
            lines.append("Kho Lavitree chưa có thuốc hóa học cho bệnh này. Vui lòng hỏi Kỹ sư nông nghiệp khi có kết nối mạng.")

        final_text = "\n".join(lines)
        # Hậu kiểm an toàn bằng post_filter_response
        blocked_chem = [chem for chem in chem_medicines if chem not in filtered_chem]
        final_text = post_filter_response(
            final_text,
            harvest_days_left,
            had_phi_violation,
            blocked_medicines=blocked_chem,
            allowed_medicines=filtered_chem + bio_measures
        )
        final_text = apply_hitl_tag(final_text)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return {
            "disease_code": actual_disease_code,
            "final_answer": final_text,
            "citations": citations,
            "guardrail_triggered": HARVEST_BEFORE_PHI_VIOLATION if had_phi_violation else None,
            "is_offline_fallback": True,
            "execution_time_ms": round(elapsed_ms, 2)
        }


# Singleton instances toàn cục
circuit_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=60.0)
offline_router = OfflineRouter()
