from django.conf import settings
from django.db import models


class PatientProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='patient_profile',
    )
    date_of_birth = models.DateField(null=True, blank=True)
    allergies = models.TextField(blank=True)
    medical_notes = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=255, blank=True)
    insurance_provider = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Paciente {self.user.get_full_name() or self.user.username}"


class ClinicalRecord(models.Model):
    """Historial clínico del paciente"""
    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.CASCADE,
        related_name='clinical_records',
    )
    appointment = models.ForeignKey(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='clinical_records',
    )
    professional = models.ForeignKey(
        'staff.ProfessionalProfile',
        on_delete=models.SET_NULL,
        null=True,
        related_name='clinical_records',
    )
    treatment = models.CharField(max_length=255)
    notes = models.TextField()
    diagnosis = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"Registro clínico {self.treatment} - {self.patient}"


class Document(models.Model):
    """Documentos adjuntos (consentimientos, radiografías, etc.)"""
    class DocumentType(models.TextChoices):
        CONSENT = 'CONSENT', 'Consentimiento Informado'
        XRAY = 'XRAY', 'Radiografía'
        REPORT = 'REPORT', 'Informe'
        PRESCRIPTION = 'PRESCRIPTION', 'Receta'
        OTHER = 'OTHER', 'Otro'

    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    document_type = models.CharField(
        max_length=20,
        choices=DocumentType.choices,
        default=DocumentType.OTHER,
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='documents/%Y/%m/%d/')
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_documents',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self) -> str:
        return f"{self.title} - {self.patient}"
