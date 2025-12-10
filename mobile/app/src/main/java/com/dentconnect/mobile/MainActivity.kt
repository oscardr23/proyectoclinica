package com.dentconnect.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.dentconnect.mobile.data.Appointment
import com.dentconnect.mobile.data.User
import com.dentconnect.mobile.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DentConnectTheme {
                val context = LocalContext.current
                val vm: MainViewModel = viewModel(
                    factory = ViewModelProvider.AndroidViewModelFactory.getInstance(
                        context.applicationContext as android.app.Application
                    )
                )
                val state by vm.uiState.collectAsState()
                Surface(modifier = Modifier.fillMaxSize()) {
                    if (state.user == null) {
                        LoginScreen(
                            loading = state.loading,
                            error = state.error,
                            onLogin = vm::login
                        )
                    } else {
                        MainScreen(
                            user = state.user!!,
                            appointments = state.appointments,
                            loading = state.loading,
                            error = state.error,
                            onRefresh = vm::loadAppointments,
                            onLogout = vm::logout
                        )
                    }
                }
            }
        }
    }
}

enum class Screen {
    APPOINTMENTS, HISTORY, PROFILE, HELP
}

@Composable
fun MainScreen(
    user: User,
    appointments: List<Appointment>,
    loading: Boolean,
    error: String?,
    onRefresh: () -> Unit,
    onLogout: () -> Unit,
) {
    var currentScreen by remember { mutableStateOf(Screen.APPOINTMENTS) }
    
    Scaffold(
        bottomBar = {
            BottomNavigationBar(
                currentScreen = currentScreen,
                onScreenSelected = { currentScreen = it }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (currentScreen) {
                Screen.APPOINTMENTS -> AppointmentsScreen(
                    user = user,
                    appointments = appointments.filter { 
                        it.status.uppercase() != "COMPLETED" && it.status.uppercase() != "CANCELLED"
                    },
                    loading = loading,
                    error = error,
                    onRefresh = onRefresh,
                    onProfileClick = { currentScreen = Screen.PROFILE },
                    modifier = Modifier.fillMaxSize()
                )
                Screen.HISTORY -> HistoryScreen(
                    appointments = appointments.filter { 
                        it.status.uppercase() == "COMPLETED" || it.status.uppercase() == "CANCELLED"
                    },
                    loading = loading,
                    modifier = Modifier.fillMaxSize()
                )
                Screen.PROFILE -> ProfileScreen(
                    user = user,
                    onLogout = onLogout,
                    modifier = Modifier.fillMaxSize()
                )
                Screen.HELP -> HelpScreen(modifier = Modifier.fillMaxSize())
            }
        }
    }
}

@Composable
fun BottomNavigationBar(
    currentScreen: Screen,
    onScreenSelected: (Screen) -> Unit
) {
    val items = listOf(
        Screen.APPOINTMENTS to Icons.Default.DateRange,
        Screen.HISTORY to Icons.Default.List,
        Screen.PROFILE to Icons.Default.Person,
        Screen.HELP to Icons.Default.Info
    )
    
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shadowElevation = 8.dp,
        color = CardBackground
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            items.forEach { (screen, icon) ->
                BottomNavItem(
                    icon = icon,
                    label = when (screen) {
                        Screen.APPOINTMENTS -> "Citas"
                        Screen.HISTORY -> "Historial"
                        Screen.PROFILE -> "Perfil"
                        Screen.HELP -> "Ayuda"
                    },
                    selected = currentScreen == screen,
                    onClick = { onScreenSelected(screen) }
                )
            }
        }
    }
}

@Composable
fun BottomNavItem(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = if (selected) PurpleStart else TextTertiary,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            fontSize = 12.sp,
            color = if (selected) PurpleStart else TextTertiary,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
fun LoginScreen(
    loading: Boolean,
    error: String?,
    onLogin: (String, String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(PurpleStart, PurpleEnd)
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Logo/Title
            Text(
                text = "DentConnect",
                style = MaterialTheme.typography.displayMedium,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            Text(
                text = "Pacientes",
                style = MaterialTheme.typography.titleLarge,
                color = Color.White.copy(alpha = 0.9f),
                modifier = Modifier.padding(bottom = 32.dp)
            )

            // Login Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp)
                ) {
                    Text(
                        text = "Iniciar Sesión",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 24.dp)
                    )

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email") },
                        leadingIcon = { Icon(Icons.Default.Email, null) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !loading
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Contraseña") },
                        leadingIcon = { Icon(Icons.Default.Lock, null) },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !loading
                    )

                    if (error != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = error,
                            color = StatusCancelled,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Button(
                        onClick = { onLogin(email, password) },
                        enabled = !loading && email.isNotBlank() && password.isNotBlank(),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = PurpleStart
                        )
                    ) {
                        if (loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White
                            )
                        } else {
                            Text(
                                "Entrar",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AppointmentsScreen(
    user: User,
    appointments: List<Appointment>,
    loading: Boolean,
    error: String?,
    onRefresh: () -> Unit,
    onProfileClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Background)
    ) {
        // Header con gradiente
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(PurpleStart, PurpleEnd)
                    )
                )
                .padding(24.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Avatar clickeable
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(Color.White.copy(alpha = 0.3f))
                            .clickable(onClick = onProfileClick),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${user.firstName.firstOrNull() ?: ""}${user.lastName.firstOrNull() ?: ""}",
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Mis Citas",
                    style = MaterialTheme.typography.headlineMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Gestiona tus próximas visitas",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.9f),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }

        // Greeting Card
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = CardBackground)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        brush = Brush.horizontalGradient(
                            colors = listOf(PurpleStart, PurpleEnd)
                        )
                    )
                    .padding(20.dp)
            ) {
                Column {
                    Text(
                        text = "Hola, ${user.firstName}",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Tienes ${appointments.size} ${if (appointments.size == 1) "cita próxima" else "citas próximas"}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.9f),
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }

        // Appointments List
        if (loading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = PurpleStart)
            }
        } else if (error != null) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = error,
                        color = StatusCancelled,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = onRefresh) {
                        Text("Reintentar")
                    }
                }
            }
        } else if (appointments.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(32.dp)
                ) {
                    Icon(
                        Icons.Default.DateRange,
                        null,
                        modifier = Modifier.size(64.dp),
                        tint = TextTertiary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "No tienes citas próximas",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextSecondary
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Text(
                        text = "📅 Próximas Citas",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        modifier = Modifier.padding(vertical = 8.dp)
                    )
                }
                items(appointments) { appointment ->
                    AppointmentCard(appointment = appointment)
                }
            }
        }
    }
}

@Composable
fun AppointmentCard(appointment: Appointment) {
    val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
    val displayFormat = SimpleDateFormat("d MMMM, HH:mm", Locale("es", "ES"))
    val dateFormatShort = SimpleDateFormat("d MMM", Locale("es", "ES"))
    
    val startTime = try {
        dateFormat.parse(appointment.startTime)
    } catch (e: Exception) {
        null
    }
    
    val isToday = startTime?.let {
        val today = Calendar.getInstance()
        val appointmentDate = Calendar.getInstance().apply { time = it }
        today.get(Calendar.YEAR) == appointmentDate.get(Calendar.YEAR) &&
        today.get(Calendar.DAY_OF_YEAR) == appointmentDate.get(Calendar.DAY_OF_YEAR)
    } ?: false
    
    val statusColor = when (appointment.status.uppercase()) {
        "CONFIRMED", "CONFIRMADA" -> StatusConfirmed
        "PENDING", "PENDIENTE" -> StatusPending
        "CANCELLED", "CANCELADA" -> StatusCancelled
        else -> TextSecondary
    }
    
    val statusText = when (appointment.status.uppercase()) {
        "CONFIRMED", "CONFIRMADA" -> "Confirmada"
        "PENDING", "PENDIENTE" -> "Pendiente"
        "CANCELLED", "CANCELADA" -> "Cancelada"
        else -> appointment.status
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { /* Navigate to details */ },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Date Badge
                    Box(
                        modifier = Modifier
                            .background(
                                brush = Brush.horizontalGradient(
                                    colors = listOf(PurpleStart, PurpleEnd)
                                ),
                                shape = RoundedCornerShape(10.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = if (isToday) "HOY" else startTime?.let { dateFormatShort.format(it).uppercase() } ?: "",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                    
                    Column {
                        Text(
                            text = startTime?.let { displayFormat.format(it) } ?: appointment.startTime,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = startTime?.let { 
                                val calendar = Calendar.getInstance().apply { time = it }
                                val days = arrayOf("Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado")
                                days[calendar.get(Calendar.DAY_OF_WEEK) - 1]
                            } ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = PurpleStart,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
                
                // Status Badge
                Surface(
                    color = statusColor.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Text(
                        text = statusText,
                        color = statusColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            Divider()
            Spacer(modifier = Modifier.height(12.dp))
            
            // Professional Info
            Text(
                text = "${appointment.professional.user.firstName} ${appointment.professional.user.lastName}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
            Text(
                text = "${appointment.treatmentType} - ${appointment.patient.user.firstName} ${appointment.patient.user.lastName}",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
                modifier = Modifier.padding(top = 4.dp)
            )
            Row(
                modifier = Modifier.padding(top = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.LocationOn,
                    null,
                    tint = TextTertiary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = appointment.room.name,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextTertiary
                )
            }
        }
    }
}

@Composable
fun HistoryScreen(
    appointments: List<Appointment>,
    loading: Boolean,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Background)
            .padding(16.dp)
    ) {
        Text(
            text = "📋 Historial",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
            modifier = Modifier.padding(bottom = 16.dp)
        )
        
        if (loading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = PurpleStart)
            }
        } else if (appointments.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.List,
                        null,
                        modifier = Modifier.size(64.dp),
                        tint = TextTertiary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "No hay historial disponible",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextSecondary
                    )
                }
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(appointments) { appointment ->
                    Box(modifier = Modifier.alpha(0.7f)) {
                        AppointmentCard(appointment = appointment)
                    }
                }
            }
        }
    }
}


@Composable
fun ProfileScreen(
    user: User,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Background)
            .padding(16.dp)
    ) {
        Text(
            text = "👤 Perfil",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
            modifier = Modifier.padding(bottom = 24.dp)
        )
        
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp)
            ) {
                // Avatar
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(RoundedCornerShape(40.dp))
                        .background(
                            brush = Brush.horizontalGradient(
                                colors = listOf(PurpleStart, PurpleEnd)
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "${user.firstName.firstOrNull() ?: ""}${user.lastName.firstOrNull() ?: ""}",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 32.sp
                    )
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = "${user.firstName} ${user.lastName}",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = user.email,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary,
                    modifier = Modifier.padding(top = 4.dp)
                )
                if (user.phone != null) {
                    Text(
                        text = user.phone,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Button(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = StatusCancelled
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("Cerrar Sesión", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun HelpScreen(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Background)
            .padding(16.dp)
    ) {
        Text(
            text = "💬 Ayuda",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
            modifier = Modifier.padding(bottom = 24.dp)
        )
        
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp)
            ) {
                Text(
                    text = "DentConnect",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Sistema de gestión de citas para clínicas dentales",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary,
                    modifier = Modifier.padding(top = 8.dp)
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                Divider()
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = "¿Necesitas ayuda?",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                Text(
                    text = "Contacta con tu clínica para cualquier consulta o problema técnico.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )
            }
        }
    }
}
