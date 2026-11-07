from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ==============================================================================
# 1. MCP Standard Protocol Models (JSON Schema Compatible)
# ==============================================================================

class ToolParameterProperty(BaseModel):
    type: str
    description: Optional[str] = None
    default: Optional[Any] = None
    enum: Optional[List[str]] = None


class ToolInputSchema(BaseModel):
    type: Literal["object"] = "object"
    properties: Dict[str, ToolParameterProperty]
    required: List[str] = Field(default_factory=list)


class MCPToolDefinition(BaseModel):
    """Định nghĩa công cụ theo chuẩn Model Context Protocol (MCP)."""
    name: str
    description: str
    inputSchema: ToolInputSchema


class MCPCallRequest(BaseModel):
    arguments: Dict[str, Any] = Field(default_factory=dict)


class MCPCallResponse(BaseModel):
    tool: str
    is_error: bool = False
    result: Any
    error_code: Optional[Literal["NOT_FOUND", "INVALID_INPUT", "UPSTREAM_UNAVAILABLE", "INTERNAL"]] = None
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0


# ==============================================================================
# 2. Tool 1: lookup_disease_knowledge
# ==============================================================================

class LookupDiseaseKnowledgeInput(BaseModel):
    disease_code: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Mã định danh bệnh học cây trồng (ví dụ: 'Tomato___Late_blight', 'Tomato___Early_blight')."
    )
    query_focus: Optional[str] = Field(
        None,
        max_length=500,
        description="Trọng tâm câu hỏi hoặc từ khóa ngữ cảnh (ví dụ: 'biện pháp sinh học', 'triệu chứng lá')."
    )
    top_k: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Số lượng đoạn trích tri thức tối đa cần lấy từ Hybrid RAG."
    )


class CitationChunk(BaseModel):
    source_id: str
    source_title: str
    organization: str
    source_url: str
    excerpt: str = Field(..., description="Đoạn trích tóm lược hiển thị cho người dùng/UI.")
    full_text: str = Field(..., description="Toàn văn bằng chứng khoa học cho AI đọc suy luận, bảo toàn liều lượng pha chế.")
    unit_type: str
    is_verbatim: bool


class LookupDiseaseKnowledgeOutput(BaseModel):
    disease_code: str
    disease_name: str
    total_found: int
    citations: List[CitationChunk]


# ==============================================================================
# 3. Tool 2: check_weather_risk
# ==============================================================================

class CheckWeatherRiskInput(BaseModel):
    location: str = Field(
        ...,
        min_length=1,
        max_length=120,
        description="Tên tỉnh, thành phố hoặc địa danh trồng cây tại Việt Nam (ví dụ: 'Hà Nam', 'Đà Lạt', 'Hà Nội')."
    )
    forecast_hours: int = Field(
        default=12,
        ge=1,
        le=72,
        description="Số giờ dự báo tới (mặc định 12 giờ)."
    )


class CheckWeatherRiskOutput(BaseModel):
    location: str
    temperature_c: float
    humidity_percent: int
    rainfall_probability_percent: int
    rainfall_mm: float
    is_rain: bool
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    recommendation: str
    forecast_hours: int
    is_simulated: bool
    cached_at: str


# ==============================================================================
# 4. Tool 3: query_pesticide_store
# ==============================================================================

class QueryPesticideStoreInput(BaseModel):
    disease_code: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Mã bệnh để lọc thuốc BVTV phù hợp trong kho Lavitree Store (ví dụ: 'Tomato___Late_blight')."
    )
    require_rain_resistant: Optional[bool] = Field(
        None,
        description="Nếu True: chỉ lấy các thuốc có tính năng bám dính chống mưa rửa trôi."
    )
    # Tuyệt đối không cho LLM tùy chọn allowed_only=False để tránh AI vô tình yêu cầu thuốc cấm!


class PesticideItem(BaseModel):
    id: int
    name: str
    active_ingredient: str
    medicine_type: str
    price: float
    dosage_instruction: str = Field(..., min_length=1)
    phi_days: int = Field(..., ge=0, le=1000)
    is_allowed: bool = Field(...)
    rain_resistant: bool = False
    stock_quantity: int = 0
    image_url: str = ""


class QueryPesticideStoreOutput(BaseModel):
    total: int
    disease_code: str
    is_fallback: bool = False  # True: danh mục mẫu của Core khi chạy dev, không phải kho thật
    items: List[PesticideItem]


# ==============================================================================
# 5. Tool 4: verify_phi_safety
# ==============================================================================

class VerifyPhiSafetyInput(BaseModel):
    harvest_days_left: int = Field(
        ...,
        ge=0,
        le=3650,
        description="Số ngày còn lại dự kiến đến thời điểm thu hoạch nông sản."
    )
    phi_days: int = Field(
        ...,
        ge=0,
        le=1000,
        description="Thời gian cách ly Pre-Harvest Interval (PHI) của thuốc BVTV tính theo ngày."
    )


class VerifyPhiSafetyOutput(BaseModel):
    harvest_days_left: int
    phi_days: int
    is_safe: bool
    risk_level: Literal["SAFE", "CRITICAL_VIOLATION"]
    message: str
    guardrail_code: Optional[str] = None
