package com.ptit.lavitree.data.model

data class DiagnosisResponse(
    val recordId: String,
    val plantName: String,
    val diseaseNameVi: String,
    val classCode: String,
    val isHealthy: Boolean,
    val confidence: Float,
    val isUncertain: Boolean,
    val warningMessage: String?,
    val gradCamImageUrl: String?,
    val originalImageUrl: String,
    val symptoms: String,
    val treatmentSteps: List<TreatmentStepDto>,
    val recommendedProducts: List<ProductDto>,
    val diagnosedAt: String
)

data class TreatmentStepDto(
    val stepOrder: Int,
    val actionTitle: String,
    val instructions: String,
    val isolationDays: String?
)

data class ProductDto(
    val id: Int,
    val name: String,
    val activeIngredient: String,
    val price: Double,
    val imageUrl: String?,
    val dosageInstruction: String
)

data class DiseaseSummaryDto(
    val id: Int,
    val classCode: String,
    val plantName: String,
    val commonNameVi: String,
    val pathogenType: String,
    val severityLevel: Int
)
