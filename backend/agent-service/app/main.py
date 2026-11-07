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

async def generate_chat_events(request: ChatRequest) -> AsyncGenerator[str, None]:
    """
    SSE Generator mô phỏng chính xác hợp đồng api-contracts.md Mục 4.1
    Tích hợp trích dẫn thực tế từ Hybrid RAG.
    """
    start_time = time.time()
    trace_id = f"tr-{uuid.uuid4().hex[:8]}"
    conv_id = request.conversation_id or f"conv-{uuid.uuid4().hex[:8]}"
    harvest_days = request.harvest_days_left if request.harvest_days_left is not None else 0
    location = request.location or "Hà Nam"
    disease_code = request.current_disease_code or "Tomato___Late_blight"

    def format_sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    # 1. Event trace_start
    yield format_sse("trace_start", {
        "trace_id": trace_id,
        "conversation_id": conv_id,
        "status": "thinking"
    })
    await asyncio.sleep(0.05)

    # 2. Event thought (Bước 1)
    yield format_sse("thought", {
        "step": 1,
        "thought": f"Cần kiểm tra thời tiết tại {location} chiều nay để xem có nguy cơ mưa rửa trôi thuốc hay phát tán nấm bệnh không."
    })
    await asyncio.sleep(0.05)

    # 3. Event action (Gọi tool check_weather_risk)
    yield format_sse("action", {
        "step": 1,
        "tool": "check_weather_risk",
        "params": {"location": location, "forecast_hours": 12}
    })
    await asyncio.sleep(0.05)

    # 4. Event observation
    yield format_sse("observation", {
        "step": 1,
        "result": {
            "is_rain": True,
            "rainfall_mm": 20,
            "humidity": 92,
            "recommendation": "NGUY CƠ RỬA TRÔI"
        }
    })
    await asyncio.sleep(0.05)

    # 5. Event thought (Bước 2)
    guardrail_triggered = "HARVEST_BEFORE_PHI_VIOLATION" if harvest_days <= 3 else None
    if harvest_days <= 3:
        thought_msg = f"Trời chiều nay có mưa to. Cây dự kiến thu hoạch sau {harvest_days} ngày -> vi phạm thời gian cách ly PHI của thuốc hóa học (7-14 ngày). Kích hoạt Code Guardrail chặn thuốc BVTV hóa học, tìm giải pháp cơ học & sinh học thay thế."
    else:
        thought_msg = f"Kiểm tra danh mục thuốc BVTV cho mã bệnh {disease_code} và tài liệu khuyến nông đã duyệt."

    yield format_sse("thought", {
        "step": 2,
        "thought": thought_msg
    })
    await asyncio.sleep(0.05)

    # 6. Event delta (Stream các token văn bản)
    full_answer_text = (
        "[DRAFT_RECOMMENDATION]\n"
        f"Chào bác! Hệ thống Lavitree đã phân tích thông tin về vườn cây ({disease_code}) tại {location}:\n\n"
        f"1. ⛔ KHÔNG PHUN THUỐC HÓA HỌC: Hiện tại chỉ còn {harvest_days} ngày đến kỳ thu hoạch và có nguy cơ mưa (20mm). "
        "Các loại thuốc BVTV hóa học (như Ridomil Gold) có thời gian cách ly PHI tối thiểu 7 ngày, việc phun lúc này vi phạm an toàn thực phẩm.\n"
        "2. ✂️ BIỆN PHÁP CƠ HỌC: Tiến hành cắt tỉa ngay các chùm lá, quả xuất hiện vết bệnh mốc sương. Cho vào bao ni-lông kín và mang tiêu hủy xa vườn.\n"
        "3. 🌿 BIỆN PHÁP SINH HỌC: Bác có thể cân nhắc chế phẩm sinh học đối kháng (Trichoderma Bacillus, PHI 0 ngày) để tưới hạn chế nấm lây lan mà không lo tồn dư độc hại."
    )

    tokens = [
        "[DRAFT_RECOMMENDATION]\n",
        f"Chào bác! ",
        f"Hệ thống Lavitree ",
        f"đã phân tích thông tin ",
        f"vườn cây tại {location}:\n\n",
        "1. ⛔ KHÔNG PHUN THUỐC HÓA HỌC: ",
        f"Hiện tại chỉ còn {harvest_days} ngày đến kỳ thu hoạch ",
        "và có nguy cơ mưa rửa trôi (20mm). ",
        "Các thuốc BVTV hóa học có PHI từ 7 ngày trở lên, ",
        "phun lúc này sẽ gây tồn dư độc hại.\n",
        "2. ✂️ BIỆN PHÁP CƠ HỌC: ",
        "Cắt tỉa ngay chùm lá bị bệnh, ",
        "cho vào bao kín tiêu hủy xa vườn.\n",
        "3. 🌿 BIỆN PHÁP SINH HỌC: ",
        "Sử dụng chế phẩm sinh học an toàn (như Trichoderma, PHI 0 ngày) ",
        "để phòng trừ lây lan."
    ]

    for token in tokens:
        yield format_sse("delta", {"token": token})
        await asyncio.sleep(0.02)

    # 7. Event final_answer
    total_ms = int((time.time() - start_time) * 1000)
    
    # Tra cứu trích dẫn học thuật từ Hybrid RAG thực tế (chuẩn SSOT chống LLM bịa nguồn)
    try:
        # Embedding tốn CPU: chạy ở luồng khác để không làm đứng các luồng SSE đang mở
        rag_res = await asyncio.to_thread(
            get_rag_pipeline().lookup_disease_knowledge,
            disease_code,
            query=request.message,
            top_k=2
        )
        citations = [
            {
                "source_id": c.source_id,
                "source_title": c.source_title,
                "organization": c.organization,
                "source_url": c.source_url,
                "excerpt": c.text[:220] + ("..." if len(c.text) > 220 else ""),
                "unit_type": c.unit_type,
                "is_verbatim": c.is_verbatim
            }
            for c in rag_res.top_chunks
        ]
    except Exception as e:
        logger.warning(f"Error fetching citations for chat: {e}")
        citations = []

    yield format_sse("final_answer", {
        "trace_id": trace_id,
        "answer": full_answer_text,
        "draft_order": None,
        "guardrail_triggered": guardrail_triggered,
        "is_offline_fallback": False,
        "citations": citations,
        "total_latency_ms": max(total_ms, 850)
    })

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
async def chat_agent(request: ChatRequest):
    """
    Day 1 Contract Endpoint: POST /api/v1/agent/chat (Streaming SSE)
    SSOT: docs/architecture/api-contracts.md Mục 4.1
    """
    return StreamingResponse(
        generate_chat_events(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
