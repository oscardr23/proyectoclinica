from django.contrib import admin

from .models import ProfessionalProfile


@admin.register(ProfessionalProfile)
class ProfessionalAdmin(admin.ModelAdmin):
    list_display = ('user', 'specialty', 'license_number')
    search_fields = ('user__first_name', 'user__last_name', 'license_number')
