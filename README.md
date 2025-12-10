 # DentConnect - Sistema de Gestión de Citas para Clínica Dental

Repositorio de la segunda entrega del proyecto **DentConnect**, compuesto por:

- `backend/`: API REST en Django + DRF + JWT.
- `web/`: Panel Angular para profesionales y administradores.
- `mobile/`: App Android nativa (Jetpack Compose) orientada a pacientes.
- `docs/`: Documentación de arquitectura y despliegue.

## Requisitos

| Capa | Dependencias |
| --- | --- |
| Backend | Python 3.10+, PostgreSQL 14+, virtualenv |
| Web | Node 20+, npm |
| Mobile | Android Studio Ladybug+, JDK 17 |

## Puesta en marcha rápida

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend web
cd ../web
npm install
npm start

# Android
cd ../mobile
./gradlew assembleDebug   # o abrir carpeta desde Android Studio
```

El backend expone `http://localhost:8000/api/` y la web se conecta por defecto al mismo host (`environment.ts`). La app móvil apunta a `http://10.0.2.2:8000/api`.

## Funcionalidades cubiertas

- **Pacientes**: app móvil para autenticación, consulta de próximas citas y estados.
- **Profesionales / Administradores**: dashboard Angular con agenda, fichas, recursos, servicios y facturas.
- **API**: control de acceso por roles, endpoints CRUD, validaciones de concurrencia y documentación automática (Swagger en `/api/docs/`).

## Documentación

- `docs/ARCHITECTURE.md`: descripción de capas, interacción y requisitos técnicos.
- `web/` y `mobile/` incluyen README internos generados por las herramientas.

## Tests y verificación

- Django `python manage.py check` y migraciones generadas.
- Angular `npm run build`.
- Android `./gradlew lint` (ejecutar desde Android Studio).

## Próximos pasos sugeridos

1. Añadir cobertura de pruebas unitarias/integra en Django y Angular.
2. Implementar colas reales para notificaciones.
3. Añadir internacionalización y accesibilidad AA en la web.