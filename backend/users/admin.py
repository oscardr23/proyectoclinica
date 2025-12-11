from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Rol y contacto', {'fields': ('role', 'phone', 'document_id')}),
        ('Hash de contraseña', {'fields': ('password_hash_display',)}),
    )
    list_display = ('username', 'email', 'role', 'is_active')
    list_filter = ('role', 'is_active')
    readonly_fields = ('password_hash_display',)

    def password_hash_display(self, obj):
        if obj.pk:
            return obj.password
        return "Guardar primero para ver el hash"
    password_hash_display.short_description = "Hash de contraseña"
