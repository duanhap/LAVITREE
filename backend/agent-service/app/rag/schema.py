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
    unit_type: str = "SUMMARY"
    is_verbatim: bool = False
    rrf_score: float = 0.0

class RetrievalResult(BaseModel):
    """Kết quả trả về chuẩn của Facade RAG phục vụ FastMCP Tool lookup_disease_knowledge."""
    disease_code: str
    disease_name: str
    top_chunks: List[RetrievalChunk] = Field(default_factory=list)

class ParagraphItem(BaseModel):
    id: str
    text: str

class SuggestedParagraph(BaseModel):
    id: str
    unit_type: str  # SYMPTOMS | CAUSE_CONDITIONS | PREVENTION | TREATMENT

class LabelParagraphsRequest(BaseModel):
    model_class: str
    paragraphs: List[ParagraphItem]

class LabelParagraphsResponse(BaseModel):
    suggestions: List[SuggestedParagraph] = Field(default_factory=list)
    ai_suggestion_available: bool = True

class ReindexResponse(BaseModel):
    status: str
    indexed_count: int
    vector_store: str
    bm25_count: int

