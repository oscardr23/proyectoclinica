package com.dentconnect.mobile.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class TokenResponse(
    val access: String,
    val refresh: String,
)

@Serializable
data class LoginRequest(
    val username: String,
    val password: String,
)

@Serializable
data class User(
    val id: Int,
    val username: String,
    val email: String,
    @SerialName("first_name") val firstName: String,
    @SerialName("last_name") val lastName: String,
    val role: String,
    val phone: String? = null,
)

@Serializable
data class PatientProfile(
    val id: Int,
    val user: User,
    @SerialName("medical_notes") val medicalNotes: String? = null,
    val allergies: String? = null,
)

@Serializable
data class ProfessionalProfile(
    val id: Int,
    val user: User,
    val specialty: String,
)

@Serializable
data class Room(
    val id: Int,
    val name: String,
)

@Serializable
data class Appointment(
    val id: Int,
    val patient: PatientProfile,
    val professional: ProfessionalProfile,
    val room: Room,
    @SerialName("start_time") val startTime: String,
    @SerialName("end_time") val endTime: String,
    val status: String,
    @SerialName("treatment_type") val treatmentType: String,
)

