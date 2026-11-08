package com.ptit.lavitree.data.model

import com.google.gson.annotations.SerializedName

/**
 * DTOs cho phân hệ Hội thoại Tác tử AI Lavi (Khớp api-contracts.md Mục 4.1)
 */
data class ChatRequest(
    @SerializedName("message") val message: String,
    @SerializedName("conversation_id") val conversationId: String? = null,
    @SerializedName("location") val location: String? = "Hà Nam",
    @SerializedName("harvest_days_left") val harvestDaysLeft: Int? = null,
    @SerializedName("current_disease_code") val currentDiseaseCode: String? = null
)

data class CitationDto(
    @SerializedName("source_title") val sourceTitle: String?,
    @SerializedName("organization") val organization: String?,
    @SerializedName("source_url") val sourceUrl: String?,
    @SerializedName("excerpt") val excerpt: String?,
    @SerializedName("is_verbatim") val isVerbatim: Boolean = false
)

data class ChatMessageItem(
    val id: String,
    val isUser: Boolean,
    val text: String,
    val timestamp: Long = System.currentTimeMillis(),
    val citations: List<CitationDto> = emptyList(),
    val isDraft: Boolean = false,
    val guardrailTriggered: Boolean = false,
    val isOfflineFallback: Boolean = false,
    val latencyMs: Long? = null
)
