package com.ptit.lavitree.data.model

import com.google.gson.annotations.SerializedName

/**
 * DTO khớp `docs/architecture/api-contracts.md`:
 * - Mục 3.1 `POST /api/v1/diagnose`
 * - Mục 3.2 `GET /api/v1/diagnose/history`
 * - Mục 3.4.1 `GET /api/v1/diseases`
 *
 * Gson gán thẳng vào field (bỏ qua constructor của Kotlin), nên mọi trường server có thể bỏ trống
 * hoặc trả null đều khai báo nullable để không vỡ ở runtime.
 */
data class DiagnosisResponse(
    @SerializedName("success") val success: Boolean = false,
    // Khách vãng lai và ảnh OOD không được lưu: diagnosis_id = null
    @SerializedName("diagnosis_id") val diagnosisId: String? = null,
    @SerializedName("is_ood") val isOod: Boolean = false,
    @SerializedName("is_uncertain") val isUncertain: Boolean = false,
    @SerializedName("warning") val warning: String? = null,
    @SerializedName("result") val result: DiagnosisResultDto? = null,
    @SerializedName("visual_evidence") val visualEvidence: VisualEvidenceDto? = null,
    @SerializedName("treatment_guidelines") val treatmentGuidelines: List<TreatmentStepDto>? = null,
    @SerializedName("recommended_products") val recommendedProducts: List<ProductDto>? = null,
    @SerializedName("verified_sources") val verifiedSources: List<VerifiedSourceDto>? = null
)

data class DiagnosisResultDto(
    @SerializedName("plant_name") val plantName: String? = null,
    @SerializedName("disease_name") val diseaseName: String? = null,
    @SerializedName("class_code") val classCode: String? = null,
    @SerializedName("confidence") val confidence: Float = 0f,
    @SerializedName("severity_level") val severityLevel: String? = null,
    @SerializedName("is_uncertain") val isUncertain: Boolean = false,
    @SerializedName("confusion_group") val confusionGroup: String? = null,
    @SerializedName("warning") val warning: String? = null
)

data class VisualEvidenceDto(
    @SerializedName("original_image_url") val originalImageUrl: String? = null,
    @SerializedName("gradcam_image_url") val gradcamImageUrl: String? = null
)

data class TreatmentStepDto(
    @SerializedName("step_order") val stepOrder: Int = 0,
    @SerializedName("action_title") val actionTitle: String? = null,
    @SerializedName("instructions") val instructions: String? = null,
    @SerializedName("isolation_days") val isolationDays: String? = null
)

data class ProductDto(
    @SerializedName("id") val id: Int = 0,
    @SerializedName("name") val name: String? = null,
    @SerializedName("active_ingredient") val activeIngredient: String? = null,
    @SerializedName("price") val price: Double = 0.0,
    @SerializedName("unit") val unit: String? = null,
    @SerializedName("image_url") val imageUrl: String? = null
)

data class VerifiedSourceDto(
    @SerializedName("organization") val organization: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("url") val url: String? = null
)

/** Mục 3.2: lịch sử trả về dạng phân trang, không phải mảng. */
data class DiagnosisHistoryPage(
    @SerializedName("total_records") val totalRecords: Int = 0,
    @SerializedName("page") val page: Int = 1,
    @SerializedName("page_size") val pageSize: Int = 0,
    @SerializedName("items") val items: List<DiagnosisHistoryItemDto>? = null
)

data class DiagnosisHistoryItemDto(
    @SerializedName("id") val id: String? = null,
    @SerializedName("created_at") val createdAt: String? = null,
    @SerializedName("plant_name") val plantName: String? = null,
    @SerializedName("disease_name") val diseaseName: String? = null,
    @SerializedName("class_code") val classCode: String? = null,
    @SerializedName("confidence") val confidence: Float = 0f,
    @SerializedName("is_uncertain") val isUncertain: Boolean = false,
    @SerializedName("recovery_status") val recoveryStatus: String? = null,
    @SerializedName("original_image_url") val originalImageUrl: String? = null,
    @SerializedName("gradcam_image_url") val gradcamImageUrl: String? = null
)

data class DiseaseSummaryDto(
    @SerializedName("id") val id: String? = null,
    @SerializedName("plant_id") val plantId: String? = null,
    @SerializedName("plant_name") val plantName: String? = null,
    @SerializedName("class_code") val classCode: String? = null,
    @SerializedName("common_name_vi") val commonNameVi: String? = null,
    @SerializedName("symptoms") val symptoms: String? = null,
    @SerializedName("prevention") val prevention: String? = null,
    @SerializedName("severity_level") val severityLevel: String? = null
)
