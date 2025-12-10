from django.db import models


class Room(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = 'AVAILABLE', 'Disponible'
        OCCUPIED = 'OCCUPIED', 'Ocupada'
        MAINTENANCE = 'MAINTENANCE', 'Mantenimiento'

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    equipment = models.ManyToManyField(
        'Equipment',
        blank=True,
        related_name='rooms',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )
    is_active = models.BooleanField(default=True)  # Mantener para compatibilidad

    def __str__(self) -> str:
        return self.name


class Equipment(models.Model):
    """Equipos disponibles en la clínica"""
    class Status(models.TextChoices):
        AVAILABLE = 'AVAILABLE', 'Disponible'
        MAINTENANCE = 'MAINTENANCE', 'Mantenimiento'
        OUT_OF_SERVICE = 'OUT_OF_SERVICE', 'Fuera de servicio'

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='equipment_items',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )
    serial_number = models.CharField(max_length=100, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    last_maintenance = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Equipment'
        ordering = ['name']

    def __str__(self) -> str:
        return f"{self.name} ({self.get_status_display()})"
