from django.contrib import admin

from .models import ClinicalRecord, Document, PatientProfile


@admin.register(PatientProfile)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('user', 'date_of_birth', 'insurance_provider')
    search_fields = ('user__first_name', 'user__last_name', 'user__email')


@admin.register(ClinicalRecord)
class ClinicalRecordAdmin(admin.ModelAdmin):
    list_display = ('patient', 'professional', 'treatment', 'created_at')
    list_filter = ('created_at', 'professional')
    search_fields = ('patient__user__first_name', 'patient__user__last_name', 'treatment')
    date_hierarchy = 'created_at'


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'patient', 'document_type', 'uploaded_by', 'uploaded_at')
    list_filter = ('document_type', 'uploaded_at')
    search_fields = ('title', 'patient__user__first_name', 'patient__user__last_name')
    date_hierarchy = 'uploaded_at'
