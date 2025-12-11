package com.dentconnect.mobile.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.withContext

class BackgroundProcessor {
    
    suspend fun calculateStatistics(
        appointments: List<Appointment>
    ): AppointmentStats = withContext(Dispatchers.Default) {
        val totalAsync = async { appointments.size }
        val confirmedAsync = async { 
            appointments.count { it.status.uppercase() == "CONFIRMED" } 
        }
        val pendingAsync = async { 
            appointments.count { it.status.uppercase() == "PENDING" } 
        }
        val cancelledAsync = async { 
            appointments.count { it.status.uppercase() == "CANCELLED" } 
        }
        
        awaitAll(totalAsync, confirmedAsync, pendingAsync, cancelledAsync).let {
            AppointmentStats(
                total = it[0] as Int,
                confirmed = it[1] as Int,
                pending = it[2] as Int,
                cancelled = it[3] as Int
            )
        }
    }
    
    suspend fun processAppointmentsInParallel(
        appointments: List<Appointment>
    ): ProcessedData = withContext(Dispatchers.Default) {
        val statusCount = async {
            appointments.groupingBy { it.status.uppercase() }.eachCount()
        }
        
        val treatmentCount = async {
            appointments.groupingBy { it.treatmentType }.eachCount()
        }
        
        val futureCount = async {
            appointments.count { 
                try {
                    val startTime = java.time.Instant.parse(it.startTime)
                    startTime.isAfter(java.time.Instant.now())
                } catch (e: Exception) {
                    false
                }
            }
        }
        
        awaitAll(statusCount, treatmentCount, futureCount).let {
            ProcessedData(
                byStatus = it[0] as Map<String, Int>,
                byTreatment = it[1] as Map<String, Int>,
                futureCount = it[2] as Int
            )
        }
    }
}

data class AppointmentStats(
    val total: Int,
    val confirmed: Int,
    val pending: Int,
    val cancelled: Int
)

data class ProcessedData(
    val byStatus: Map<String, Int>,
    val byTreatment: Map<String, Int>,
    val futureCount: Int
)

