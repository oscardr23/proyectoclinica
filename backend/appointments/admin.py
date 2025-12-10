from django.contrib import admin

from .models import Appointment, Notification


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('patient', 'professional', 'start_time', 'status')
    list_filter = ('status', 'professional')
    search_fields = ('patient__user__first_name', 'patient__user__last_name')
    filter_horizontal = ('equipment',)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('patient', 'notification_type', 'channel', 'sent_at', 'read_at')
    list_filter = ('notification_type', 'channel', 'sent_at', 'read_at')
    search_fields = ('patient__user__first_name', 'patient__user__last_name', 'title')
    date_hierarchy = 'created_at'
