package com.ptit.lavitree.data.api

import com.ptit.lavitree.data.model.DiagnosisResponse
import com.ptit.lavitree.data.model.DiseaseSummaryDto
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

interface LavitreeApiService {

    @Multipart
    @POST("api/v1/diagnose/scan")
    async fun scanLeaf(
        @Part image: MultipartBody.Part,
        @Part("note") note: String? = null
    ): Response<DiagnosisResponse>

    @GET("api/v1/diseases")
    async fun getHandbookDiseases(
        @Query("plantId") plantId: Int? = null,
        @Query("keyword") keyword: String? = null
    ): Response<List<DiseaseSummaryDto>>

    @GET("api/v1/diagnose/history")
    async fun getDiagnosisHistory(): Response<List<DiagnosisResponse>>
}
