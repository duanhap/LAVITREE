"""
Chốt chặn dùng chung cho các test E2E của Core API (BUG-79).

Các test này tạo tài khoản, đơn hàng, lượt khám... và API không có lệnh xóa,
nên chạy nhầm vào CSDL thật sẽ để lại dữ liệu rác (đã xảy ra ở BUG-72).

Mặc định TỪ CHỐI chạy (thoát mã 2, không phải 0 để không bị hiểu là "đạt") khi:
  1. Chuỗi kết nối CSDL trong môi trường / .env trỏ tới Supabase, hoặc
  2. CORE_API_URL không phải máy local (ví dụ https://lavitree.io.vn).
Muốn chạy có chủ đích trên hệ thống thật: đặt ALLOW_LIVE_DB_TEST=true.

Dọn dữ liệu test trên DB local (Docker), ví dụ:
  docker exec <container-postgres> psql -U postgres -d <db> -c \
    "DELETE FROM \"Users\" WHERE \"Email\" LIKE 'farmer\\_%' OR \"Email\" LIKE '%@test.local';"
(Xóa Users trước thì phải xóa DiagnosisRecords / Orders của các user đó trước nếu có khóa ngoại.)
"""
import os
import sys
from urllib.parse import urlparse

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "core-api", "host.docker.internal"}
_SUPABASE_MARKERS = ("supabase.co", "supabase.com")


def _load_env_file(path: str) -> None:
    """Nạp .env vào os.environ (không ghi đè biến đã có), giống cách Core đọc .env."""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                if k and k not in os.environ:
                    os.environ[k] = v.strip().strip('"').strip("'")


def guard_live_db(script_name: str, core_api_url: str | None = None) -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    _load_env_file(os.path.join(here, ".env"))
    _load_env_file(os.path.join(here, "..", "..", ".env"))

    if os.environ.get("ALLOW_LIVE_DB_TEST", "").strip().lower() in ("true", "1"):
        print(f"[AN TOÀN CSDL] ALLOW_LIVE_DB_TEST=true: {script_name} chạy trên hệ thống thật theo yêu cầu.")
        return

    reasons = []
    db_conn = (
        os.environ.get("ConnectionStrings__DefaultConnection")
        or os.environ.get("SUPABASE_CONNECTION_STRING")
        or ""
    ).lower()
    if any(m in db_conn for m in _SUPABASE_MARKERS):
        reasons.append("chuỗi kết nối CSDL đang trỏ tới Supabase")

    url = core_api_url or os.environ.get("CORE_API_URL", "")
    host = (urlparse(url).hostname or "").lower() if url else ""
    if host and host not in _LOCAL_HOSTS:
        reasons.append(f"CORE_API_URL trỏ tới máy chủ khác máy local ({host})")

    if reasons:
        print("\n" + "!" * 75)
        print(f"  [AN TOÀN CSDL] {script_name} TỪ CHỐI chạy: " + "; ".join(reasons) + ".")
        print("  Test này ghi dữ liệu (tài khoản, đơn hàng, lượt khám) mà API không xóa được.")
        print("  Hãy chạy với Core local + DB local. Nếu thật sự muốn chạy trên hệ thống thật:")
        print(f"    ALLOW_LIVE_DB_TEST=true python {script_name}")
        print("!" * 75 + "\n")
        sys.exit(2)
