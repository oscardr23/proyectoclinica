from django.conf import settings
from django.db import models


class ProfessionalProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='professional_profile',
    )
    specialty = models.CharField(max_length=120)
    license_number = models.CharField(max_length=80, unique=True)
    bio = models.TextField(blank=True)
    working_days = models.CharField(
        max_length=64,
        help_text='Días disponibles. Ej: LUN-VIE',
    )
    start_hour = models.TimeField(null=True, blank=True)
    end_hour = models.TimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.user.get_full_name()} ({self.specialty})"
