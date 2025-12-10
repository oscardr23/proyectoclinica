from django.conf import settings
from django.db import models
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone


class Appointment(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pendiente'
        CONFIRMED = 'CONFIRMED', 'Confirmada'
        COMPLETED = 'COMPLETED', 'Completada'
        CANCELLED = 'CANCELLED', 'Cancelada'

    patient = models.ForeignKey(
        'patients.PatientProfile',
        on_delete=models.CASCADE,
        related_name='appointments',
    )
    professional = models.ForeignKey(
        'staff.ProfessionalProfile',
        on_delete=models.CASCADE,
        related_name='appointments',
    )
    room = models.ForeignKey(
        'resources.Room',
        on_delete=models.PROTECT,
        related_name='appointments',
    )
    equipment = models.ManyToManyField(
        'resources.Equipment',
        blank=True,
        related_name='appointments',
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    treatment_type = models.CharField(max_length=120)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_appointments',
    )
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_time']
        constraints = [
            # Solo validamos que end_time > start_time
            # La validación de solapamiento se hace en clean() y en el serializer
            models.CheckConstraint(
                check=models.Q(end_time__gt=models.F('start_time')),
                name='end_time_after_start_time',
            ),
        ]

    def __str__(self) -> str:
        return f"Cita {self.start_time} - {self.patient}"

    def clean(self):
        """Validaciones a nivel de modelo"""
        if self.end_time <= self.start_time:
            raise ValidationError('La hora de fin debe ser posterior a la hora de inicio.')
        
        # Validar que no haya solapamiento con otras citas para el mismo profesional
        if self.pk:
            overlapping_professional = Appointment.objects.filter(
                professional=self.professional,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
                start_time__lt=self.end_time,
                end_time__gt=self.start_time,
            ).exclude(pk=self.pk)
        else:
            overlapping_professional = Appointment.objects.filter(
                professional=self.professional,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
                start_time__lt=self.end_time,
                end_time__gt=self.start_time,
            )
        
        if overlapping_professional.exists():
            raise ValidationError('Ya existe una cita en ese horario para este profesional.')
        
        # Validar que no haya solapamiento con otras citas para la misma sala
        if self.pk:
            overlapping_room = Appointment.objects.filter(
                room=self.room,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
                start_time__lt=self.end_time,
                end_time__gt=self.start_time,
            ).exclude(pk=self.pk)
        else:
            overlapping_room = Appointment.objects.filter(
                room=self.room,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
                start_time__lt=self.end_time,
                end_time__gt=self.start_time,
            )
        
        if overlapping_room.exists():
            raise ValidationError('La sala no está disponible en ese horario.')

    def save(self, *args, **kwargs):
        self.full_clean()
        if self.pk:
            self.version += 1
        super().save(*args, **kwargs)

    def can_be_cancelled(self, user):
        """Verifica si la cita puede ser cancelada por el usuario"""
        if self.status == Appointment.Status.CANCELLED:
            return False, 'La cita ya está cancelada.'
        
        if self.status == Appointment.Status.COMPLETED:
            return False, 'No se puede cancelar una cita completada.'
        
        # Pacientes solo pueden cancelar con 24h de antelación
        if user.role == user.Roles.PATIENT:
            time_until_appointment = self.start_time - timezone.now()
            if time_until_appointment.total_seconds() < 24 * 3600:
                return False, 'Las citas solo pueden cancelarse con al menos 24 horas de antelación.'
        
        return True, None

    @transaction.atomic
    def cancel(self, user, reason=None):
        """Cancela la cita con validaciones"""
        can_cancel, error = self.can_be_cancelled(user)
        if not can_cancel:
            raise ValidationError(error)
        
        self.status = Appointment.Status.CANCELLED
        if reason:
            self.notes = f"{self.notes}\n\nCancelación: {reason}".strip()
        self.save(update_fields=['status', 'notes'])


class Notification(models.Model):
    """Notificaciones del sistema (recordatorios, confirmaciones, etc.)"""
    class NotificationType(models.TextChoices):
        APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER', 'Recordatorio de cita'
        APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED', 'Cita confirmada'
        APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED', 'Cita cancelada'
        APPOINTMENT_MODIFIED = 'APPOINTMENT_MODIFIED', 'Cita modificada'
        BUDGET_READY = 'BUDGET_READY', 'Presupuesto disponible'
        INVOICE_ISSUED = 'INVOICE_ISSUED', 'Factura emitida'

    class Channel(models.TextChoices):
        EMAIL = 'EMAIL', 'Email'
        SMS = 'SMS', 'SMS'
        PUSH = 'PUSH', 'Push Notification'
        IN_APP = 'IN_APP', 'En la aplicación'

    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
    )
    patient = models.ForeignKey(
        'patients.PatientProfile',
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
    )
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        default=Channel.IN_APP,
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.notification_type} - {self.patient}"
