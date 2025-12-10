## DentConnect Patient (Android)

Aplicación Android nativa con Jetpack Compose para que los pacientes:

- Inicien sesión mediante las credenciales del backend (JWT).
- Consulten sus próximas citas y estados.
- Actualicen el listado bajo demanda.

### Requisitos

- Android Studio Ladybug o superior.
- SDK 34 instalado.
- Emulador o dispositivo con Android 8.0+.

### Ejecución

```bash
cd mobile
./gradlew assembleDebug
```

Para usar el backend local desde emulador, se debe mantener el servidor Django expuesto en `http://10.0.2.2:8000`. Cambiar `BuildConfig.API_URL` en `app/build.gradle.kts` si se despliega en otra URL.

