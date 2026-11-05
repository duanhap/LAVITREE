from typing import List, Optional
from pydantic import BaseModel, Field

class KnowledgeRecord(BaseModel):
    """Bản ghi tri thức khuyến nông từ CSDL PostgreSQL (SSOT) hoặc CSV seed."""
    id: str
    model_class: str
    plant_name: str = ""
    disease_name: str = ""
    source_title: str = ""
    organization: str = ""
    source_url: str = ""
    evidence_text: str
    unit_type: str = "SUMMARY"
    is_verbatim: bool = False
    is_manual_approved: bool = True

class RetrievalChunk(BaseModel):
    """Một đoạn tri thức trích dẫn được xếp hạng từ Hybrid RAG."""
    source_id: str
    text: str
    source_title: str
    organization: str
    source_url: str
    model_class: str = ""
    plant_name: str = ""
    disease_name: str = ""
    unit_type: str = "SUMMARY"
    is_verbatim: bool = False
    rrf_score: float = 0.0

class RetrievalResult(BaseModel):
    """Kết quả trả về chuẩn của Facade RAG phục vụ FastMCP Tool lookup_disease_knowledge."""
    disease_code: str
    disease_name: str
    top_chunks: List[RetrievalChunk] = Field(default_factory=list)

class ParagraphItem(BaseModel):
    id: str = Field(..., min_length=1, max_length=50, description="Mã định danh đoạn trích")
    text: str = Field(..., min_length=1, max_length=2000, description="Nội dung văn bản đoạn trích (tối đa 2000 ký tự)")

class SuggestedParagraph(BaseModel):
    id: str
    unit_type: str  # SYMPTOMS | CAUSE_CONDITIONS | PREVENTION | TREATMENT

class LabelParagraphsRequest(BaseModel):
    model_class: str = Field(..., min_length=1, max_length=100, description="Mã bệnh (ví dụ: Tomato___Late_blight)")
    paragraphs: List[ParagraphItem] = Field(..., min_length=1, max_length=200, description="Danh sách đoạn văn bản cần gán nhãn (tối đa 200 đoạn)")

class LabelParagraphsResponse(BaseModel):
    suggestions: List[SuggestedParagraph] = Field(default_factory=list)
    ai_suggestion_available: bool = True

class ReindexResponse(BaseModel):
    status: str
    indexed_count: int
    vector_store: str
    bm25_count: int
