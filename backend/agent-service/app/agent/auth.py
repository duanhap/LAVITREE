import os
import secrets
import time
import logging
import threading
from typing import Dict, List, Optional
from dataclasses import dataclass
from fastapi import Request, HTTPException, status

from app.agent.memory import stm_memory

logger = logging.getLogger("agent.auth")

GUEST_DAILY_LIMIT = int(os.getenv("GUEST_DAILY_LIMIT", "5"))
GUEST_WINDOW_SECONDS = 86400  # 24 giờ


@dataclass
class UserContext:
    user_id: Optional[str]
    email: Optional[str]
    role: str
    is_guest: bool
    client_ip: str

    @property
    def owner_key(self) -> str:
        """Định danh dùng để gán và kiểm tra quyền sở hữu conversation_id."""
        if self.user_id:
            return f"user:{self.user_id}"
        return f"guest:{self.client_ip}"


class GuestRateLimiter:
    """
    Bộ đếm giới hạn lượt hỏi của Khách vãng lai theo IP (roles-usecases.md Mục 1.1).
    Khách vãng lai chỉ được hỏi tối đa 5 lượt / 24 giờ để chống cạn kiệt ngân sách Gemini.
    """
    def __init__(self, limit: int = GUEST_DAILY_LIMIT, window_seconds: int = GUEST_WINDOW_SECONDS):
        self.limit = limit
        self.window_seconds = window_seconds
        self._history: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def check_and_increment(self, client_ip: str) -> None:
        now = time.time()
        with self._lock:
            # Lọc bỏ các mốc thời gian ngoài cửa sổ 24h
            records = self._history.get(client_ip, [])
            valid_records = [t for t in records if (now - t) < self.window_seconds]
            if len(valid_records) >= self.limit:
                logger.warning(f"[RateLimit] Guest IP {client_ip} exceeded daily limit ({len(valid_records)}/{self.limit}).")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Khách vãng lai đã dùng hết {self.limit} lượt hỏi/ngày theo quy định bảo vệ ngân sách API. Vui lòng đăng nhập tài khoản Lavitree để tiếp tục sử dụng."
                )
            valid_records.append(now)
            self._history[client_ip] = valid_records
            # Dọn IP đã hết hạn để bộ đếm không phình mãi theo số IP lạ
            if len(self._history) > 10_000:
                self._history = {
                    ip: times for ip, times in self._history.items()
                    if times and (now - times[-1]) < self.window_seconds
                }

    def reset_for_test(self) -> None:
        with self._lock:
            self._history.clear()


guest_limiter = GuestRateLimiter()


def get_client_ip(request: Request) -> str:
    """
    IP thật của client. nginx ghi đè X-Real-IP bằng $remote_addr nên client không giả được;
    không đọc X-Forwarded-For vì gọi thẳng cổng 8001 thì header này do client tự đặt.
    """
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def has_valid_internal_key(request: Request) -> bool:
    """Request đến từ Core API trong mạng Docker (cùng khóa X-Internal-Key với check_internal_auth)."""
    expected_key = os.environ.get("INTERNAL_API_SECRET")
    key = request.headers.get("x-internal-key")
    if not expected_key or not key:
        return False
    return secrets.compare_digest(key.encode("utf-8"), expected_key.encode("utf-8"))


def _decode_jwt(token: str) -> dict:
    """Giải mã JWT do Core API phát hành; thiếu cấu hình thì từ chối (fail-closed), không dùng khóa mặc định."""
    import jwt

    secret = os.getenv("JWT_SECRET_KEY")
    if not secret:
        logger.error("[Auth] JWT_SECRET_KEY is not configured. Rejecting bearer token (fail-closed).")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dịch vụ xác thực chưa sẵn sàng."
        )

    issuer = os.getenv("JWT_ISSUER")
    audience = os.getenv("JWT_AUDIENCE")
    return jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        issuer=issuer,
        audience=audience,
        options={"verify_iss": bool(issuer), "verify_aud": bool(audience), "require": ["exp"]}
    )


def get_user_context(request: Request) -> UserContext:
    """
    Trích xuất danh tính và phân quyền người dùng từ JWT Bearer Token hoặc nhận diện Guest qua IP.
    Không trừ lượt hỏi ở đây: chỉ endpoint chat mới gọi enforce_guest_quota().
    SSOT: roles-usecases.md & api-contracts.md.
    """
    client_ip = get_client_ip(request)
    auth_header = request.headers.get("authorization")

    # 1. Trường hợp có JWT Token
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        try:
            payload = _decode_jwt(token)
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"[Auth] Invalid JWT token: {type(e).__name__}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token xác thực không hợp lệ hoặc đã hết hạn."
            )

        # Trích xuất Claims chuẩn theo JwtTokenService.cs
        user_id = payload.get("sub") or payload.get("nameid")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token xác thực không hợp lệ hoặc đã hết hạn."
            )
        role = str(
            payload.get("role") or
            payload.get("http://schemas.microsoft.com/ws/2008/06/identity/claims/role") or
            "FARMER"
        ).upper()

        logger.info(f"[Auth] Authenticated user {user_id} (Role: {role}) from IP {client_ip}")
        return UserContext(
            user_id=str(user_id),
            email=payload.get("email"),
            role=role,
            is_guest=False,
            client_ip=client_ip
        )

    # 2. Header X-User-Id chỉ được tin khi request mang khóa nội bộ của Core API.
    # nginx chuyển nguyên header của trình duyệt, nên thiếu bước này ai cũng tự xưng được là ADMIN.
    internal_user_id = request.headers.get("x-user-id")
    if internal_user_id and has_valid_internal_key(request):
        role = request.headers.get("x-user-role", "FARMER").upper()
        return UserContext(
            user_id=internal_user_id,
            email=None,
            role=role,
            is_guest=False,
            client_ip=client_ip
        )

    # 3. Người dùng chưa đăng nhập -> Khách Vãng Lai (Guest)
    return UserContext(
        user_id=None,
        email=None,
        role="GUEST",
        is_guest=True,
        client_ip=client_ip
    )


def enforce_guest_quota(user_ctx: UserContext) -> None:
    """Trừ một lượt hỏi của Khách vãng lai; hết lượt thì trả 429."""
    if user_ctx.is_guest:
        guest_limiter.check_and_increment(user_ctx.client_ip)


def validate_conversation_owner(conversation_id: str, user_ctx: UserContext) -> None:
    """
    Kiểm tra chủ sở hữu phiên hội thoại (chống IDOR).
    Khách hoặc Nông dân chỉ được đọc/ghi vào conversation_id của chính mình.
    Admin có quyền đọc mọi conversation_id phục vụ giám sát kỹ thuật.
    """
    if not conversation_id:
        return

    owner = stm_memory.get_owner(conversation_id)
    if owner is not None:
        if owner != user_ctx.owner_key and user_ctx.role != "ADMIN":
            logger.warning(
                f"[Auth] Forbidden IDOR access: Conversation '{conversation_id}' belongs to '{owner}', "
                f"but requester is '{user_ctx.owner_key}'"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập phiên hội thoại này."
            )
    else:
        # Phiên mới chưa có chủ -> gán chủ quyền
        stm_memory.register_session(conversation_id, user_ctx.owner_key)

