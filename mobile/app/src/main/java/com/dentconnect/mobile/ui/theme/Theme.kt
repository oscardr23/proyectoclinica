package com.dentconnect.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val colorScheme = lightColorScheme(
    primary = PurpleStart,
    secondary = PurpleEnd,
    tertiary = BluePrimary,
    background = Background,
    surface = CardBackground,
    onPrimary = androidx.compose.ui.graphics.Color.White,
    onSecondary = androidx.compose.ui.graphics.Color.White,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    error = StatusCancelled,
    onError = androidx.compose.ui.graphics.Color.White,
)

@Composable
fun DentConnectTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}

