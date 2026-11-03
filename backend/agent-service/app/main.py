import asyncio
import json
import uuid
import time
import os
import secrets
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator, List
from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.rag.knowledge_retriever import AgriKnowledgeRetriever
from app.rag.schema import LabelParagraphsRequest, LabelParagraphsResponse
from app.rag.pipeline import rag_pipeline
from app.agent.prompts import AGRI_AGENT_SYSTEM_PROMPT

app = FastAPI(
    title="Lavitree Agri-Agent Service",
    description="Agentic RAG & FastMCP trợ lý tư vấn nông nghiệp bảo vệ thực vật",
    version="1.0.0"
)

# CORS middleware hỗ trợ Web Portal & dev client kết nối trực tiếp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

retriever = AgriKnowledgeRetriever()

def check_internal_auth(request: Request):
    """
    Xác thực API Key nội bộ giữa các container (Docker Network).
    Bảo vệ các endpoint quản trị /internal/* theo chuẩn api-contracts.md Mục 4.3 & 4.4.
    """
    key = request.headers.get("x-internal-key") or request.headers.get("X-Internal-Key")
    expected_key = os.environ.get("INTERNAL_API_SECRET", "lavitree_internal_secret_key_super_secure_32chars!")
    if not key or not secrets.compare_digest(key, expected_key):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Invalid or missing X-Internal-Key"
        )
    return True

class ConsultationRequest(BaseModel):
    disease_code: str
    crop_stage: Optional[str] = "Phát triển thân lá"
    weather_condition: Optional[str] = "Bình thường"
    user_query: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    location: Optional[str] = None
    harvest_days_left: Optional[int] = None
    current_disease_code: Optional[str] = None

class ReindexRequest(BaseModel):
    source_id: Optional[str] = None
    action: Optional[str] = "approve"

@app.get("/health")
def health():
    return {"status": "ok", "service": "agent-service", "port": 8001}

@app.post("/internal/reindex")
async def trigger_reindex(request: Request):
    """
    POST /internal/reindex
    Endpoint nội bộ dành cho Core API thông báo khi Admin duyệt bài viết tri thức mới.
    SSOT: docs/architecture/api-contracts.md Mục 4.3
    """
    check_internal_auth(request)
    res = rag_pipeline.reindex()
    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "status": "success",
        "message": "Chỉ mục tri thức đã được tái lập thành công",
        "indexed_documents": res.indexed_count,
        "timestamp": now_iso
    }

@app.post("/internal/knowledge/label-paragraphs")
async def label_paragraphs(request: Request):
    """
    POST /internal/knowledge/label-paragraphs
    AI gợi ý nhãn cho từng đoạn bài báo (HITL Ingestion).
    SSOT: docs/architecture/api-contracts.md Mục 4.4
    """
    check_internal_auth(request)
    data = await request.json()
    req = LabelParagraphsRequest(**data)
    res = rag_pipeline.label_paragraphs(req)
    return {
        "labels": [{"id": s.id, "unit_type": s.unit_type} for s in res.suggestions]
    }


@app.post("/api/v1/agent/consult-treatment")
def consult_treatment(request: ConsultationRequest):
    kb_info = retriever.search_guideline(request.disease_code)
    
    advice = f"""[Khuyến nghị chuyên gia Lavitree]:
- Bệnh: {kb_info['vietnamese_name']}
- Giai đoạn cây: {request.crop_stage}
- Biện pháp sinh học & canh tác: {kb_info['organic_treatment']}
- Thuốc BVTV gợi ý: {kb_info['chemical_treatment']}
- Thời gian cách ly an toàn (PHI): {kb_info['phi_days']}
Lưu ý: Luôn tuân thủ nguyên tắc '4 Đúng' trong bảo vệ thực vật (Đúng thuốc, đúng liều lượng, đúng lúc, đúng cách)."""

    return {
        "disease_code": request.disease_code,
        "knowledge_evidence": kb_info,
        "consultant_advice": advice
    }

async def generate_chat_events(request: ChatRequest) -> AsyncGenerator[str, None]:
    """
    Stub SSE Generator mô phỏng chính xác hợp đồng api-contracts.md Mục 4.1
    Phục vụ Thành viên A dựng giao diện Web/Mobile mà không bị block.
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
    await asyncio.sleep(0.1)

    # 2. Event thought (Bước 1)
    yield format_sse("thought", {
        "step": 1,
        "thought": f"Cần kiểm tra thời tiết tại {location} chiều nay để xem có nguy cơ mưa rửa trôi thuốc hay phát tán nấm bệnh không."
    })
    await asyncio.sleep(0.15)

    # 3. Event action (Gọi tool check_weather_risk)
    yield format_sse("action", {
        "step": 1,
        "tool": "check_weather_risk",
        "params": {"location": location, "forecast_hours": 12}
    })
    await asyncio.sleep(0.15)

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
    await asyncio.sleep(0.15)

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
    await asyncio.sleep(0.15)

    # 6. Event delta (Stream các token văn bản)
    full_answer_text = (
        "[DRAFT_RECOMMENDATION]\n"
        f"Chào bác! Hệ thống Lavitree đã phân tích thông tin về vườn cây ({disease_code}) tại {location}:\n\n"
        f"1. ⛔ KHÔNG PHUN THUỐC HÓA HỌC: Hiện tại chỉ còn {harvest_days} ngày đến kỳ thu hoạch và có nguy cơ mưa (20mm). "
        "Các loại thuốc BVTV hóa học (như Ridomil Gold) có thời gian cách ly PHI tối thiểu 7 ngày, việc phun lúc này vi phạm an toàn thực phẩm.\n"
        "2. ✂️ BIỆN PHÁP CƠ HỌC: Tiến hành cắt tỉa ngay các chùm lá, quả xuất hiện vết bệnh mốc sương. Cho vào bao ni-lông kín và mang tiêu hủy xa vườn.\n"
        "3. 🌿 BIỆN PHÁP SINH HỌC: Bác có thể cân nhắc chế phẩm sinh học đối kháng (Trichoderma Bacillus, PHI 0 ngày) để tưới hạn chế nấm lây lan mà không lo tồn dư độc hại."
    )

    # Tách đoạn và stream từng cụm từ
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
        await asyncio.sleep(0.04)

    # 7. Event final_answer
    total_ms = int((time.time() - start_time) * 1000)
    
    # Tra cứu trích dẫn học thuật từ Hybrid RAG thực tế (chuẩn SSOT chống LLM bịa nguồn)
    try:
        rag_res = rag_pipeline.lookup_disease_knowledge(disease_code, query=request.message, top_k=2)
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

