import logging
import threading
import time
from datetime import datetime, timezone
from typing import Callable, Optional

logger = logging.getLogger("rag.reindex_worker")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ReindexCoordinator:
    """
    Chạy reindex ở luồng nền, tối đa một lượt tại một thời điểm.

    Yêu cầu đến giữa lúc đang chạy không bị bỏ: nó bật cờ "pending" để chạy thêm đúng một lượt,
    nên lượt cuối luôn đọc dữ liệu mới nhất (ví dụ bài vừa bị bỏ duyệt).
    Lỗi DB tạm thời được thử lại; hết lượt thử thì giữ nguyên chỉ mục cũ và ghi nhận trạng thái.
    """

    def __init__(
        self,
        run: Callable[[], int],
        max_retries: int = 5,
        retry_delay_seconds: float = 5.0,
    ):
        self._run = run
        self._max_retries = max_retries
        self._retry_delay_seconds = retry_delay_seconds
        self._lock = threading.Lock()
        self._pending = False
        self._running = False
        self._indexed_documents: Optional[int] = None
        self._last_success_at: Optional[str] = None
        self._last_failure_at: Optional[str] = None
        self._last_error: Optional[str] = None

    def request(self) -> None:
        """Ghi nhận một yêu cầu reindex và trả về ngay, không chờ dựng chỉ mục."""
        with self._lock:
            self._pending = True
            if self._running:
                return
            self._running = True
        threading.Thread(target=self._worker, name="rag-reindex", daemon=True).start()

    def status(self) -> dict:
        with self._lock:
            return {
                "running": self._running,
                "pending": self._pending,
                "indexed_documents": self._indexed_documents,
                "last_success_at": self._last_success_at,
                "last_failure_at": self._last_failure_at,
                "last_error": self._last_error,
            }

    def _record_success(self, count: int) -> None:
        with self._lock:
            self._indexed_documents = count
            self._last_success_at = _now_iso()
            self._last_error = None

    def _record_failure(self, code: str) -> None:
        with self._lock:
            self._last_failure_at = _now_iso()
            self._last_error = code

    def _worker(self) -> None:
        failures = 0
        while True:
            with self._lock:
                if not self._pending:
                    self._running = False
                    return
                self._pending = False

            try:
                self._record_success(self._run())
                failures = 0
            except ConnectionError as e:
                logger.error(f"Reindex failed, database unavailable: {e}")
                self._record_failure("database_unavailable")
                failures += 1
                if failures <= self._max_retries:
                    time.sleep(self._retry_delay_seconds)
                    with self._lock:
                        self._pending = True
                else:
                    failures = 0
            except ValueError as e:
                logger.error(f"Reindex failed, invalid configuration: {e}")
                self._record_failure("configuration_error")
            except Exception:
                logger.exception("Reindex failed unexpectedly")
                self._record_failure("internal_error")
