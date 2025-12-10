package com.dentconnect.mobile.data

import com.dentconnect.mobile.BuildConfig
import kotlinx.serialization.json.Json
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface DentConnectApi {
    @POST("auth/login/")
    suspend fun login(@Body request: LoginRequest): TokenResponse

    @GET("auth/me/")
    suspend fun me(): User

    @GET("appointments/")
    suspend fun appointments(): List<Appointment>
}

object ApiServiceFactory {
    fun create(tokenStore: TokenStore): DentConnectApi {
        val json = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
        }

        val authInterceptor = Interceptor { chain ->
            val token = tokenStore.accessToken
            val request = if (token.isNullOrBlank()) {
                chain.request()
            } else {
                chain.request().newBuilder()
                    .addHeader("Authorization", "Bearer $token")
                    .build()
            }
            chain.proceed(request)
        }

        val logging = HttpLoggingInterceptor().apply {
            setLevel(HttpLoggingInterceptor.Level.BASIC)
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(BuildConfig.API_URL)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .client(client)
            .build()

        return retrofit.create(DentConnectApi::class.java)
    }
}

