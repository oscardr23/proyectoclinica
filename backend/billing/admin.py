from django.contrib import admin

from .models import Budget, Invoice, InvoiceItem, Service


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'base_price', 'is_active')
    list_filter = ('is_active',)


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'status', 'total', 'issued_at')
    list_filter = ('status',)
    inlines = [InvoiceItemInline]


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'professional', 'status', 'estimated_cost')
    list_filter = ('status',)
