import os
import time
import logging
import threading
from typing import Dict, List, Optional
from dataclasses import dataclass
from fastapi import Request, HTTPException, status

from app.agent.memory import stm_memory

logger = logging.getLogger("agent.auth")

DEFAULT_JWT_SECRET = "LavitreeSecretKeyForJwtAuthentication2026!DefaultKey"
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

    def reset_for_test(self) -> None:
        with self._lock:
            self._history.clear()


guest_limiter = GuestRateLimiter()


def get_client_ip(request: Request) -> str:
    """Trích xuất địa chỉ IP thực tế của client từ reverse proxy (Nginx)."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def get_user_context(request: Request) -> UserContext:
    """
    Trích xuất danh tính và phân quyền người dùng từ JWT Bearer Token hoặc nhận diện Guest qua IP.
    SSOT: roles-usecases.md & api-contracts.md.
    """
    client_ip = get_client_ip(request)
    auth_header = request.headers.get("authorization")

    # 1. Trường hợp có JWT Token
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        secret = os.getenv("JWT_SECRET_KEY") or DEFAULT_JWT_SECRET
        try:
            import jwt
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False, "verify_iss": False}
            )
            # Trích xuất Claims chuẩn theo JwtTokenService.cs
            user_id = payload.get("sub") or payload.get("nameid")
            email = payload.get("email")
            role = (
                payload.get("role") or
                payload.get("http://schemas.microsoft.com/ws/2008/06/identity/claims/role") or
                "FARMER"
            ).upper()

            logger.info(f"[Auth] Authenticated user {user_id} (Role: {role}) from IP {client_ip}")
            return UserContext(
                user_id=str(user_id) if user_id else None,
                email=email,
                role=role,
                is_guest=False,
                client_ip=client_ip
            )
        except Exception as e:
            logger.warning(f"[Auth] Invalid JWT token: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token xác thực không hợp lệ hoặc đã hết hạn."
            )

    # 2. Hỗ trợ Header nội bộ X-User-Id khi Core API chuyển tiếp request
    internal_user_id = request.headers.get("x-user-id")
    if internal_user_id:
        role = request.headers.get("x-user-role", "FARMER").upper()
        return UserContext(
            user_id=internal_user_id,
            email=None,
            role=role,
            is_guest=False,
            client_ip=client_ip
        )

    # 3. Người dùng chưa đăng nhập -> Khách Vãng Lai (Guest)
    guest_limiter.check_and_increment(client_ip)
    return UserContext(
        user_id=None,
        email=None,
        role="GUEST",
        is_guest=True,
        client_ip=client_ip
    )


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
