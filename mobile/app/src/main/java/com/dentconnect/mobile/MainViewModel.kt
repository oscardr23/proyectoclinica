package com.dentconnect.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.dentconnect.mobile.data.ApiServiceFactory
import com.dentconnect.mobile.data.Appointment
import com.dentconnect.mobile.data.BackgroundProcessor
import com.dentconnect.mobile.data.DentConnectRepository
import com.dentconnect.mobile.data.TokenStore
import com.dentconnect.mobile.data.User
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class UiState(
    val user: User? = null,
    val appointments: List<Appointment> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
)

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val tokenStore = TokenStore(application)
    private val api = ApiServiceFactory.create(tokenStore)
    private val repository = DentConnectRepository(api, tokenStore)
    private val backgroundProcessor = BackgroundProcessor()

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState

    init {
        viewModelScope.launch {
            try {
                val (user, appointments) = repository.loadUserAndAppointments()
                if (user != null) {
                    // Si es profesional, filtrar solo sus citas
                    val filteredAppointments = if (user.role == "PROFESSIONAL") {
                        appointments.filter { appointment ->
                            appointment.professional.user.id == user.id
                        }
                    } else {
                        appointments
                    }
                    _uiState.update { it.copy(user = user, appointments = filteredAppointments) }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(user = null) }
            }
        }
    }

    fun login(username: String, password: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            runCatching {
                withContext(Dispatchers.IO) {
                    repository.login(username, password)
                }
            }.onSuccess { user ->
                _uiState.update { it.copy(user = user, loading = false, error = null) }
                loadAppointments()
            }.onFailure { error ->
                _uiState.update { it.copy(loading = false, error = error.message ?: "Error") }
            }
        }
    }

    fun loadAppointments() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true) }
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    repository.appointments()
                }
            }
            result.onSuccess { appointments ->
                val currentUser = _uiState.value.user
                // Si es profesional, filtrar solo sus citas
                val filteredAppointments = if (currentUser?.role == "PROFESSIONAL") {
                    appointments.filter { appointment ->
                        appointment.professional.user.id == currentUser.id
                    }
                } else {
                    appointments
                }
                _uiState.update { it.copy(appointments = filteredAppointments, loading = false) }
            }.onFailure { error ->
                _uiState.update { it.copy(loading = false, error = error.message) }
            }
        }
    }

    fun logout() {
        repository.logout()
        _uiState.value = UiState()
    }

    suspend fun getAppointmentStatistics(): com.dentconnect.mobile.data.AppointmentStats? {
        return try {
            backgroundProcessor.calculateStatistics(_uiState.value.appointments)
        } catch (e: Exception) {
            null
        }
    }
}

