package com.whisper.app.network

import android.content.Context
import com.whisper.app.R
import com.whisper.app.data.*
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*

interface WhisperApi {
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponse>

    @GET("rules")
    suspend fun getRules(): Response<List<Rule>>

    @POST("rules")
    suspend fun createRule(@Body body: NewRuleRequest): Response<Rule>

    @DELETE("rules/{id}")
    suspend fun deleteRule(@Path("id") id: Int): Response<Unit>

    @POST("devices")
    suspend fun registerDevice(@Body body: DeviceRegisterRequest): Response<Unit>
}

object ApiClient {
    private var retrofit: Retrofit? = null

    fun get(context: Context, prefs: Prefs): WhisperApi {
        if (retrofit == null) {
            val authInterceptor = Interceptor { chain ->
                val original = chain.request()
                val builder = original.newBuilder()
                prefs.token?.let { builder.header("Authorization", "Bearer $it") }
                chain.proceed(builder.build())
            }

            val client = OkHttpClient.Builder()
                .addInterceptor(authInterceptor)
                .build()

            retrofit = Retrofit.Builder()
                .baseUrl(context.getString(R.string.api_base_url))
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }
        return retrofit!!.create(WhisperApi::class.java)
    }
}
