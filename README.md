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
python manage.py runserver
```

**En Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data  # Cargar datos de ejemplo (opcional)
python manage.py runserver
```

**Nota para Windows:** Si PowerShell muestra un error de política de ejecución, ejecuta primero:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Frontend web

cd ../web
npm install
npm start

El backend expone `http://localhost:8000/api/` y la web se conecta por defecto al mismo host (`environment.ts`). La app móvil apunta a `http://10.0.2.2:8000/api`.
