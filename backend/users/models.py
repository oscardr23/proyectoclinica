from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Roles(models.TextChoices):
        PATIENT = 'PATIENT', 'Paciente'
        PROFESSIONAL = 'PROFESSIONAL', 'Profesional'
        ADMIN = 'ADMIN', 'Administrador'

    role = models.CharField(
        max_length=32,
        choices=Roles.choices,
        default=Roles.PATIENT,
    )
    phone = models.CharField(max_length=20, blank=True)
    document_id = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['document_id'],
                condition=models.Q(document_id__isnull=False),
                name='unique_document_id'
            )
        ]

    def is_patient(self) -> bool:
        return self.role == self.Roles.PATIENT

    def is_professional(self) -> bool:
        return self.role == self.Roles.PROFESSIONAL

    def is_admin(self) -> bool:
        return self.role == self.Roles.ADMIN

    def save(self, *args, **kwargs):
        # Si es superusuario, asignar automáticamente rol ADMIN
        if self.is_superuser and self.role != self.Roles.ADMIN:
            self.role = self.Roles.ADMIN
        super().save(*args, **kwargs)
