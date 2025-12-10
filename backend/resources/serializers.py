from rest_framework import serializers

from .models import Room, Equipment


class EquipmentSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source='room.name', read_only=True)

    class Meta:
        model = Equipment
        fields = [
            'id',
            'name',
            'description',
            'room',
            'room_name',
            'status',
            'serial_number',
            'purchase_date',
            'last_maintenance',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ('created_at', 'updated_at')


class RoomSerializer(serializers.ModelSerializer):
    equipment = EquipmentSerializer(many=True, read_only=True)
    equipment_ids = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.all(),
        many=True,
        source='equipment',
        write_only=True,
        required=False,
    )

    class Meta:
        model = Room
        fields = ['id', 'name', 'description', 'equipment', 'equipment_ids', 'status', 'is_active']

