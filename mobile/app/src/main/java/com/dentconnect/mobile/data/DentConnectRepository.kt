package com.dentconnect.mobile.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.withContext

class DentConnectRepository(
    private val api: DentConnectApi,
    private val tokenStore: TokenStore
) {
    private val cache = CacheManager()

    suspend fun login(username: String, password: String): User {
        return withContext(Dispatchers.IO) {
            val tokens = api.login(LoginRequest(username, password))
            tokenStore.accessToken = tokens.access
            cache.clear()
            api.me()
        }
    }

    suspend fun loadCurrentUser(): User? {
        return if (tokenStore.accessToken != null) {
            cache.getOrFetch("current_user") {
                withContext(Dispatchers.IO) {
                    runCatching { api.me() }.getOrNull()
                }
            }
        } else {
            null
        }
    }

    suspend fun appointments(): List<Appointment> {
        return cache.getOrFetch("appointments") {
            withContext(Dispatchers.IO) {
                api.appointments()
            }
        }
    }

    suspend fun loadUserAndAppointments(): Pair<User?, List<Appointment>> {
        return withContext(Dispatchers.IO) {
            val userDeferred = async { loadCurrentUser() }
            val appointmentsDeferred = async { appointments() }
            Pair(userDeferred.await(), appointmentsDeferred.await())
        }
    }

    fun logout() {
        tokenStore.accessToken = null
        cache.clear()
    }
}

