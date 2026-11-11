import logging
from typing import Any, Dict, Optional

from app.mcp.schema import (
    CitationChunk,
    LookupDiseaseKnowledgeInput,
    LookupDiseaseKnowledgeOutput,
    CheckWeatherRiskInput,
    CheckWeatherRiskOutput,
    QueryPesticideStoreInput,
    QueryPesticideStoreOutput,
    VerifyPhiSafetyInput,
    VerifyPhiSafetyOutput
)
from app.mcp.client import CoreApiClient
from app.rag.pipeline import get_rag_pipeline

logger = logging.getLogger("mcp.tools")


# ==============================================================================
# TOOL 1: lookup_disease_knowledge
# ==============================================================================

def lookup_disease_knowledge(
    disease_code: str,
    query_focus: Optional[str] = None,
    top_k: int = 3
) -> Dict[str, Any]:
    """
    Tra cứu tài liệu khoa học khuyến nông và cơ chế phát sinh bệnh học theo mã bệnh.
    Nguồn dữ liệu: Module Hybrid RAG (Task 06) truy xuất từ PostgreSQL SSOT và ChromaDB cục bộ.
    Cung cấp cả excerpt (hiển thị UI) và full_text (toàn văn tài liệu cho AI suy luận liều lượng).
    SSOT: api-contracts.md Mục 4.1 & 4.2
    """
    valid_input = LookupDiseaseKnowledgeInput(
        disease_code=disease_code,
        query_focus=query_focus,
        top_k=top_k
    )

    pipeline = get_rag_pipeline()
    rag_result = pipeline.lookup_disease_knowledge(
        disease_code=valid_input.disease_code,
        query=valid_input.query_focus,
        top_k=valid_input.top_k
    )

    citations = [
        CitationChunk(
            source_id=c.source_id,
            source_title=c.source_title,
            organization=c.organization,
            source_url=c.source_url,
            excerpt=c.text[:220] + ("..." if len(c.text) > 220 else ""),
            full_text=c.text,  # Toàn văn bằng chứng khoa học cho LLM suy luận, bảo toàn liều lượng pha
            unit_type=c.unit_type,
            is_verbatim=c.is_verbatim
        )
        for c in rag_result.top_chunks
    ]

    output = LookupDiseaseKnowledgeOutput(
        disease_code=rag_result.disease_code,
        disease_name=rag_result.disease_name,
        total_found=len(citations),
        citations=citations
    )
    return output.model_dump()


# ==============================================================================
# TOOL 2: check_weather_risk
# ==============================================================================

def check_weather_risk(
    location: str,
    forecast_hours: int = 12
) -> Dict[str, Any]:
    """
    Tra cứu nhiệt độ, độ ẩm và nguy cơ mưa rửa trôi thuốc BVTV tại địa phương trồng cây.
    Nguồn dữ liệu: Core API tích hợp OpenWeatherMap API kèm bộ đệm Memory Cache 1 giờ (TTL 3600s).
    Core API lỗi hoặc mất kết nối thì ném lỗi ConnectionError để Agent xử lý.
    SSOT: api-contracts.md Mục 3.9 & 4.2
    """
    valid_input = CheckWeatherRiskInput(
        location=location,
        forecast_hours=forecast_hours
    )

    client = CoreApiClient()
    output: CheckWeatherRiskOutput = client.fetch_weather(
        location=valid_input.location,
        forecast_hours=valid_input.forecast_hours
    )
    return output.model_dump()


# ==============================================================================
# TOOL 3: query_pesticide_store
# ==============================================================================

def query_pesticide_store(
    disease_code: str,
    require_rain_resistant: Optional[bool] = None
) -> Dict[str, Any]:
    """
    Tra cứu danh mục thuốc BVTV chính ngạch có sẵn trong kho, giá bán, thời gian cách ly (PHI)
    và đặc tính bám dính chống rửa trôi.
    Nguồn dữ liệu: Gọi endpoint GET /api/v1/medicines/search của Core API (.NET 8).
    Luôn bắt buộc lọc thuốc được cấp phép lưu hành (chặn 100% thuốc cấm).
    Core API lỗi hoặc mất kết nối thì ném lỗi ConnectionError để Agent xử lý.
    SSOT: api-contracts.md Mục 3.4 & 4.2
    """
    valid_input = QueryPesticideStoreInput(
        disease_code=disease_code,
        require_rain_resistant=require_rain_resistant
    )

    client = CoreApiClient()
    output: QueryPesticideStoreOutput = client.search_medicines(
        disease_code=valid_input.disease_code,
        require_rain_resistant=valid_input.require_rain_resistant
    )
    return output.model_dump()


# ==============================================================================
# TOOL 4: verify_phi_safety
# ==============================================================================

def verify_phi_safety(
    harvest_days_left: int,
    phi_days: Optional[int] = None
) -> Dict[str, Any]:
    """
    Kiểm tra an toàn thời gian cách ly (Pre-Harvest Interval - PHI).
    Kích hoạt báo động đỏ bảo thủ nếu số ngày còn lại đến kỳ thu hoạch <= thời gian cách ly của thuốc.
    Với vật tư canh tác (phi_days is None), trả về an toàn với risk_level="NOT_APPLICABLE".
    SSOT: api-contracts.md Mục 4.2
    """
    valid_input = VerifyPhiSafetyInput(
        harvest_days_left=harvest_days_left,
        phi_days=phi_days
    )

    if valid_input.phi_days is None:
        output = VerifyPhiSafetyOutput(
            harvest_days_left=valid_input.harvest_days_left,
            phi_days=None,
            is_safe=True,
            risk_level="NOT_APPLICABLE",
            message=(
                "KHÔNG ÁP DỤNG: chỉ vật tư canh tác hoặc biện pháp cơ học mới không có thời gian cách ly (PHI). "
                "Nếu đây là thuốc BVTV thì thiếu PHI, phải đọc PHI trên nhãn và KHÔNG được coi là an toàn."
            )
        )
        return output.model_dump()

    # Chốt chặn quy tắc cứng: DaysToHarvest <= PhiDays -> CRITICAL_VIOLATION
    if valid_input.harvest_days_left <= valid_input.phi_days:
        output = VerifyPhiSafetyOutput(
            harvest_days_left=valid_input.harvest_days_left,
            phi_days=valid_input.phi_days,
            is_safe=False,
            risk_level="CRITICAL_VIOLATION",
            guardrail_code="HARVEST_BEFORE_PHI_VIOLATION",
            message=(
                f"CẢNH BÁO NGUY HIỂM: Thời gian thu hoạch ({valid_input.harvest_days_left} ngày) "
                f"nhỏ hơn hoặc bằng thời gian cách ly PHI của thuốc ({valid_input.phi_days} ngày). "
                "Tuyệt đối không phun thuốc hóa học này để tránh tồn dư độc hại trong nông sản."
            )
        )
    else:
        safety_margin = valid_input.harvest_days_left - valid_input.phi_days
        output = VerifyPhiSafetyOutput(
            harvest_days_left=valid_input.harvest_days_left,
            phi_days=valid_input.phi_days,
            is_safe=True,
            risk_level="SAFE",
            guardrail_code=None,
            message=(
                f"AN TOÀN: Thời gian thu hoạch ({valid_input.harvest_days_left} ngày) lớn hơn "
                f"thời gian cách ly PHI của thuốc ({valid_input.phi_days} ngày, dôi dư an toàn {safety_margin} ngày). "
                "Có thể sử dụng nếu tuân thủ đúng liều lượng chỉ định."
            )
        )

    return output.model_dump()
