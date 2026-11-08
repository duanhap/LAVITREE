package com.ptit.lavitree.data.api

import com.ptit.lavitree.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Singleton Retrofit Client cho Lavitree Mobile App (BUG-85):
 * - Chỉ đi qua Nginx (`BuildConfig.API_BASE_URL`), không gọi thẳng cổng nội bộ 5000, 8000, 8001.
 * - Địa chỉ đặt bằng thuộc tính Gradle `lavitreeApiBaseUrl`, không viết cứng tên miền trong code.
 * - Timeout ≥ 30 giây cho upload ảnh ngoài đồng ruộng.
 */
object ApiClient {

    val baseUrl: String = BuildConfig.API_BASE_URL

    private val okHttpClient: OkHttpClient by lazy {
        val builder = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)

        // Chỉ log ở bản debug và ở mức BASIC:
        // - Mức BODY đọc hết response trước khi trả về, làm hỏng stream SSE của chat,
        //   và ghi cả ảnh lá, JWT, số điện thoại vào logcat.
        if (BuildConfig.DEBUG) {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
                redactHeader("Authorization")
            }
            builder.addInterceptor(logging)
        }

        builder.build()
    }

    val service: LavitreeApiService by lazy {
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(LavitreeApiService::class.java)
    }
}
