from django.contrib import admin

from .models import Equipment, Room


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'is_active')
    list_filter = ('is_active', 'status')
    filter_horizontal = ('equipment',)


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'room', 'status', 'is_active')
    list_filter = ('status', 'is_active', 'room')
    search_fields = ('name', 'serial_number')
