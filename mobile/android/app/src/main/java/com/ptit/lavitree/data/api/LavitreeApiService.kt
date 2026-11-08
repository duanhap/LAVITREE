package com.ptit.lavitree.data.api

import com.ptit.lavitree.data.model.ChatRequest
import com.ptit.lavitree.data.model.DiagnosisHistoryPage
import com.ptit.lavitree.data.model.DiagnosisResponse
import com.ptit.lavitree.data.model.DiseaseSummaryDto
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

interface LavitreeApiService {

    @Multipart
    @POST("api/v1/diagnose")
    suspend fun scanLeaf(
        @Part image: MultipartBody.Part,
        @Part("notes") notes: RequestBody? = null
    ): Response<DiagnosisResponse>

    // Mục 3.4.1: plantId là GUID, tham số tìm kiếm tên là "search"
    @GET("api/v1/diseases")
    suspend fun getHandbookDiseases(
        @Query("plantId") plantId: String? = null,
        @Query("search") search: String? = null
    ): Response<List<DiseaseSummaryDto>>

    // Mục 3.2: bắt buộc Bearer token, trả về trang dữ liệu { total_records, page, page_size, items }
    @GET("api/v1/diagnose/history")
    suspend fun getDiagnosisHistory(
        @Header("Authorization") bearerToken: String,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 10
    ): Response<DiagnosisHistoryPage>

    @Streaming
    @POST("api/v1/agent/chat")
    suspend fun streamChat(
        @Body request: ChatRequest
    ): Response<ResponseBody>
}
