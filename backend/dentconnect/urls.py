"""
URL configuration for dentconnect project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from appointments.views import AppointmentViewSet, NotificationViewSet
from billing.reports import activity_report, billing_report, dashboard_stats
from billing.views import BudgetViewSet, InvoiceViewSet, ServiceViewSet
from patients.views import ClinicalRecordViewSet, DocumentViewSet, PatientViewSet
from resources.views import EquipmentViewSet, RoomViewSet
from staff.views import ProfessionalViewSet
from users.views import (
    ChangePasswordView,
    CustomTokenObtainPairView,
    MeView,
    PatientRegistrationView,
    UserViewSet,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'professionals', ProfessionalViewSet, basename='professional')
router.register(r'rooms', RoomViewSet, basename='room')
router.register(r'equipment', EquipmentViewSet, basename='equipment')
router.register(r'appointments', AppointmentViewSet, basename='appointment')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'clinical-records', ClinicalRecordViewSet, basename='clinical-record')
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'budgets', BudgetViewSet, basename='budget')


def api_root(request):
    """Vista raíz que muestra información de la API"""
    return JsonResponse({
        'name': 'DentConnect API',
        'version': '0.1.0',
        'description': 'API REST para la gestión de clínicas dentales',
        'endpoints': {
            'documentation': '/api/docs/',
            'schema': '/api/schema/',
            'admin': '/admin/',
            'api_root': '/api/',
        }
    })


urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path(
        'api/docs/',
        SpectacularSwaggerView.as_view(url_name='schema'),
        name='swagger-ui',
    ),
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/me/', MeView.as_view(), name='me'),
    path('api/auth/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('api/auth/register/patient/', PatientRegistrationView.as_view(), name='patient-register'),
    path('api/reports/dashboard/', dashboard_stats, name='dashboard-stats'),
    path('api/reports/billing/', billing_report, name='billing-report'),
    path('api/reports/activity/', activity_report, name='activity-report'),
    path('api/', include(router.urls)),
]

# Servir archivos media en desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
