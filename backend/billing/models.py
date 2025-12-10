from decimal import Decimal

from django.conf import settings
from django.db import models


class Service(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    base_price = models.DecimalField(max_digits=8, decimal_places=2)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Borrador'
        SENT = 'SENT', 'Enviada'
        PAID = 'PAID', 'Pagada'
        CANCELLED = 'CANCELLED', 'Cancelada'
        OVERDUE = 'OVERDUE', 'Vencida'

    patient = models.ForeignKey(
        'patients.PatientProfile',
        on_delete=models.CASCADE,
        related_name='invoices',
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='issued_invoices',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    issued_at = models.DateField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    def recalculate_total(self):
        total = sum(item.total for item in self.items.all())
        self.total = total
        self.save(update_fields=['total'])

    def get_effective_status(self):
        """
        Calcula el estado efectivo de la factura.
        Si está SENT y la fecha de vencimiento ha pasado, devuelve OVERDUE.
        Si el estado es explícitamente OVERDUE, CANCELLED o PAID, devuelve ese estado.
        """
        from django.utils import timezone
        # Si el estado es explícitamente OVERDUE, CANCELLED o PAID, devolverlo directamente
        if self.status in [self.Status.OVERDUE, self.Status.CANCELLED, self.Status.PAID]:
            return self.status
        # Si está SENT y la fecha de vencimiento ha pasado, devolver OVERDUE
        if self.status == self.Status.SENT and self.due_date:
            if timezone.now().date() > self.due_date:
                return self.Status.OVERDUE
        return self.status

    def save(self, *args, **kwargs):
        from datetime import timedelta
        from django.utils import timezone
        
        # Si no se especifica fecha de vencimiento y se envía, establecer 30 días por defecto
        if not self.due_date and self.status == self.Status.SENT:
            if not self.pk:  # Nueva factura
                self.due_date = self.issued_at + timedelta(days=30)
            else:
                # Factura existente que se está enviando
                # Obtener la fecha de emisión actual de la BD si existe
                try:
                    old_instance = Invoice.objects.get(pk=self.pk)
                    if old_instance.issued_at:
                        self.due_date = old_instance.issued_at + timedelta(days=30)
                    else:
                        self.due_date = timezone.now().date() + timedelta(days=30)
                except Invoice.DoesNotExist:
                    self.due_date = timezone.now().date() + timedelta(days=30)
        
        # No actualizar automáticamente el estado a OVERDUE en save
        # Se calcula dinámicamente con get_effective_status()
        # Solo actualizar si se está cambiando explícitamente a SENT y está vencida
        if self.status == self.Status.SENT and self.due_date:
            if timezone.now().date() > self.due_date:
                # No cambiar el status aquí, se calcula dinámicamente
                pass
        
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Factura #{self.pk} - {self.patient}"


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='items',
    )
    service = models.ForeignKey(Service, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=8, decimal_places=2)

    @property
    def total(self) -> Decimal:
        return self.quantity * self.unit_price


class Budget(models.Model):
    patient = models.ForeignKey(
        'patients.PatientProfile',
        on_delete=models.CASCADE,
        related_name='budgets',
    )
    professional = models.ForeignKey(
        'staff.ProfessionalProfile',
        on_delete=models.SET_NULL,
        null=True,
        related_name='budgets',
    )
    description = models.TextField()
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=(
            ('DRAFT', 'Borrador'),
            ('APPROVED', 'Aprobado'),
            ('REJECTED', 'Rechazado'),
        ),
        default='DRAFT',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Presupuesto {self.pk} - {self.patient}"
