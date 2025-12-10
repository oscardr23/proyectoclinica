package com.dentconnect.mobile.data

class DentConnectRepository(private val api: DentConnectApi, private val tokenStore: TokenStore) {

    suspend fun login(username: String, password: String): User {
        val tokens = api.login(LoginRequest(username, password))
        tokenStore.accessToken = tokens.access
        return api.me()
    }

    suspend fun loadCurrentUser(): User? {
        return if (tokenStore.accessToken != null) {
            runCatching { api.me() }.getOrNull()
        } else {
            null
        }
    }

    suspend fun appointments(): List<Appointment> {
        return api.appointments()
    }

    fun logout() {
        tokenStore.accessToken = null
    }
}

