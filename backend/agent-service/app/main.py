import asyncio
import json
import uuid
import time
import os
import secrets
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal, Optional, AsyncGenerator
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.rag.schema import LabelParagraphsRequest
from app.rag.pipeline import get_rag_pipeline
from app.rag.reindex_worker import ReindexCoordinator
from app.rag.sync_index import sync_knowledge_index
from app.mcp import mcp_router
from app.agent.prompts import AGRI_AGENT_SYSTEM_PROMPT
from app.agent.react_agent import react_agent
from app.agent.auth import enforce_guest_quota, get_user_context, validate_conversation_owner
from app.agent.trace_logger import trace_logger

logger = logging.getLogger("agent.main")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Reindex chạy nền, nhiều yêu cầu cùng lúc được gộp lại (Bulk approve + Single approve)
reindex_coordinator = ReindexCoordinator(lambda: sync_knowledge_index(False))


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Model lỗi thì service dừng ngay (fail-closed), không chạy tiếp với tìm kiếm hỏng
    get_rag_pipeline()
    # Container mới phải tự có dữ liệu; DB chưa sẵn sàng thì worker tự thử lại
    reindex_coordinator.request()
    yield


app = FastAPI(
    title="Lavitree Agri-Agent Service",
    description="Agentic RAG & FastMCP trợ lý tư vấn nông nghiệp bảo vệ thực vật",
    version="1.0.0",
    lifespan=lifespan
)


def check_internal_auth(request: Request):
    """
    Xác thực API Key nội bộ giữa các container trong Docker Network.
    Tuân thủ nguyên tắc Fail-Closed: Nếu chưa cấu hình INTERNAL_API_SECRET, từ chối toàn bộ request.
    SSOT: docs/architecture/api-contracts.md Mục 4.3 & 4.4
    """
    expected_key = os.environ.get("INTERNAL_API_SECRET")
    if not expected_key:
        logger.error("INTERNAL_API_SECRET is not configured in environment. Rejecting request (fail-closed).")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Internal API secret is not configured"
        )

    key = request.headers.get("x-internal-key")
    # So sánh trên bytes: compare_digest báo lỗi với chuỗi có ký tự ngoài ASCII
    if not key or not secrets.compare_digest(key.encode("utf-8"), expected_key.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing X-Internal-Key"
        )
    return True

# Bảo vệ toàn bộ endpoint MCP bằng khóa API nội bộ X-Internal-Key (SSOT: api-contracts.md)
app.include_router(mcp_router, dependencies=[Depends(check_internal_auth)])

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = Field(None, max_length=64)
    location: Optional[str] = Field(None, max_length=120)
    harvest_days_left: Optional[int] = Field(None, ge=0, le=3650)
    current_disease_code: Optional[str] = Field(None, max_length=100)

class ReindexRequest(BaseModel):
    source_id: Optional[str] = Field(None, max_length=64)
    action: Optional[Literal["approve", "unapprove", "delete", "manual"]] = None

@app.get("/health")
def health():
    reindex = reindex_coordinator.status()
    index_ready = get_rag_pipeline().vector_retriever.get_collection().count() > 0
    healthy = index_ready and not reindex["last_error"]
    return {
        "status": "ok" if healthy else "degraded",
        "service": "agent-service",
        "port": 8001,
        "index_ready": index_ready
    }

@app.post("/internal/reindex", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(check_internal_auth)])
def trigger_reindex(payload: Optional[ReindexRequest] = None):
    """
    POST /internal/reindex
    Core API gọi khi Admin duyệt / bỏ duyệt / xoá bài. Nhận yêu cầu rồi trả về ngay,
    dựng chỉ mục ở luồng nền để không làm đứng chat và không vượt timeout 5s của Core.
    SSOT: docs/architecture/api-contracts.md Mục 4.3
    """
    logger.info(f"Reindex requested (action={payload.action if payload else None}).")
    reindex_coordinator.request()
    return {
        "status": "accepted",
        "message": "Đã nhận yêu cầu tái lập chỉ mục tri thức",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/internal/reindex/status", dependencies=[Depends(check_internal_auth)])
def reindex_status():
    """Kết quả reindex gần nhất, để Admin biết lượt chạy nền thành công hay thất bại."""
    return reindex_coordinator.status()

@app.post("/internal/knowledge/label-paragraphs", dependencies=[Depends(check_internal_auth)])
def label_paragraphs(payload: LabelParagraphsRequest):
    """
    POST /internal/knowledge/label-paragraphs
    AI gợi ý nhãn cho từng đoạn bài báo (HITL Ingestion).
    Pydantic Schema giới hạn độ dài (≤ 200 đoạn, ≤ 2000 ký tự/đoạn).
    Gemini lỗi thì trả 503 để Core báo ai_suggestion_available = false.
    SSOT: docs/architecture/api-contracts.md Mục 4.4
    """
    res = get_rag_pipeline().label_paragraphs(payload)
    if not res.ai_suggestion_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI suggestion is unavailable"
        )
    return {
        "labels": [{"id": s.id, "unit_type": s.unit_type} for s in res.suggestions]
    }

async def stream_react_chat(
    request: ChatRequest,
    conv_id: str,
    owner_id: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Generator streaming ReAct Loop thời gian thực (SSOT api-contracts.md Mục 4.1).
    Nối trực tiếp vào react_agent.run_stream(), xuất các sự kiện SSE chuẩn.
    """
    async for event_name, event_data in react_agent.run_stream(
        message=request.message,
        conversation_id=conv_id,
        disease_code=request.current_disease_code,
        location=request.location,
        harvest_days_left=request.harvest_days_left,
        owner_id=owner_id
    ):
        yield f"event: {event_name}\ndata: {json.dumps(event_data, ensure_ascii=False)}\n\n"


@app.post("/api/v1/agent/run", dependencies=[Depends(check_internal_auth)])
def run_agent_turn(request: ChatRequest):
    """
    POST /api/v1/agent/run
    Thực thi chu trình ReAct Loop đầy đủ (Gemini + FastMCP Tools + Hard Code Guardrails + STM).
    Trả về cấu trúc AgentResponse đầy đủ (steps, citations, fallback status, latency).
    """
    response = react_agent.run(
        message=request.message,
        conversation_id=request.conversation_id,
        disease_code=request.current_disease_code,
        location=request.location,
        harvest_days_left=request.harvest_days_left
    )
    return response.to_dict()


@app.post("/api/v1/agent/chat")
async def chat_agent(request: ChatRequest, req: Request):
    """
    Endpoint chuẩn SSOT Mục 4.1: POST /api/v1/agent/chat (Streaming SSE)
    Bảo mật:
    - Nhận diện JWT / Core proxy qua header, giới hạn khách vãng lai (Guest) 5 lượt/ngày theo IP.
    - Kiểm soát chặt chẽ chủ sở hữu conversation_id chống tấn công IDOR.
    - Tự động sinh UUID cho conversation_id nếu client không gửi.
    - Nối trực tiếp vào chu trình ReAct Engine và Hard Code Guardrails.
    """
    user_ctx = get_user_context(req)

    # Quản lý conversation_id (kiểm tra quyền trước khi trừ lượt hỏi của khách)
    conv_id = request.conversation_id or f"conv-{uuid.uuid4().hex[:12]}"
    validate_conversation_owner(conv_id, user_ctx)
    enforce_guest_quota(user_ctx)

    return StreamingResponse(
        stream_react_chat(request, conv_id=conv_id, owner_id=user_ctx.owner_key),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/api/v1/agent/trace/{trace_id}")
def get_agent_trace(trace_id: str, req: Request):
    """
    GET /api/v1/agent/trace/{trace_id}
    Quan sát vết thực thi XAI (Agent Observability) chuẩn SSOT api-contracts.md Mục 4.2.
    Phục vụ Màn hình Waterfall Chart trên Admin Dashboard và báo cáo hội đồng.
    """
    # Xác thực quyền: Cho phép Admin hoặc internal container
    is_internal = False
    try:
        check_internal_auth(req)
        is_internal = True
    except HTTPException:
        pass

    if not is_internal:
        user_ctx = get_user_context(req)
        if user_ctx.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ Quản trị viên (Admin) mới có quyền truy cập vết thực thi chi tiết của Agent."
            )

    trace = trace_logger.get_trace(trace_id)
    if not trace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy vết thực thi với mã '{trace_id}'."
        )

    return {
        "trace_id": trace["trace_id"],
        "timestamp": trace["timestamp"],
        "total_duration_ms": trace["total_duration_ms"],
        "total_tokens": trace["total_tokens"],
        "steps": trace["steps"]
    }


@app.get("/api/v1/agent/traces", dependencies=[Depends(check_internal_auth)])
def list_agent_traces():
    """
    GET /api/v1/agent/traces (Internal/Admin)
    Lấy danh sách các phiên thực thi gần nhất trong bộ nhớ xoay vòng.
    """
    return {"traces": trace_logger.get_all_traces()}
