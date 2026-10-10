from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.rag.knowledge_retriever import AgriKnowledgeRetriever
from app.agent.prompts import AGRI_AGENT_SYSTEM_PROMPT

app = FastAPI(
    title="Lavitree Agri-Agent Service (Bonus)",
    description="Agentic RAG trợ lý tư vấn điều trị và tra cứu cẩm nang bảo vệ thực vật",
    version="1.0.0"
)

retriever = AgriKnowledgeRetriever()

class ConsultationRequest(BaseModel):
    disease_code: str
    crop_stage: Optional[str] = "Phát triển thân lá"
    weather_condition: Optional[str] = "Bình thường"
    user_query: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "Lavitree Agri-Agent"}

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

@app.post("/api/v1/agent/chat")
def chat_agent(request: ChatRequest):
    return {
        "reply": f"Lavitree AI Agent đã nhận được câu hỏi: '{request.message}'. Hệ thống đang đối chiếu dữ liệu khuyến nông để tư vấn chính xác nhất cho bạn."
    }
