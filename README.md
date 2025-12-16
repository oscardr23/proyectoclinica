 # DentConnect - Sistema de Gestión de Citas para Clínica Dental

## Requisitos

| Capa | Dependencias |
| --- | --- |
| Backend | Python 3.10+, PostgreSQL 14+, virtualenv |
| Web | Node 20+, npm |
| Mobile | Android Studio Ladybug+, JDK 17 |

## Puesta en marcha rápida

### Backend

**En Linux/Mac:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data  # Cargar datos de ejemplo (opcional)
python manage.py runserver 0.0.0.0:8000
```

**En Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data  # Cargar datos de ejemplo (opcional)
python manage.py runserver 0.0.0.0:8000
```

**Nota para Windows:** Si PowerShell muestra un error de política de ejecución, ejecuta primero:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Frontend web

```bash
cd web
npm install
npm start
```

La aplicación web estará disponible en `http://localhost:4200` y se conectará al backend en `http://localhost:8000/api/`.

### App móvil Android

**Compilar el APK:**

1. Abre el proyecto `mobile` en Android Studio
2. Ve a **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. El APK se generará en `mobile/app/build/outputs/apk/debug/app-debug.apk`

**Configurar la URL de la API para dispositivo físico:**

Antes de compilar, actualiza la IP en `mobile/app/build.gradle.kts` con la IP local de tu ordenador:

```kotlin
buildConfigField("String", "API_URL", "\"http://TU_IP_LOCAL:8000/api/\"")
```

Para obtener tu IP local:
- **Windows:** `ipconfig` (busca "Dirección IPv4")
- **Linux/Mac:** `ifconfig` o `ip addr`

**Instalar en tu móvil:**

1. Transfiere el APK a tu móvil (USB, email, Drive, etc.)
2. En tu móvil, ve a **Configuración → Seguridad** y activa **"Instalar aplicaciones desde fuentes desconocidas"**
3. Abre el APK desde el explorador de archivos y sigue las instrucciones
4. **Importante:** Asegúrate de que tu móvil esté en la misma red WiFi que tu ordenador

