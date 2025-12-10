from rest_framework import serializers

from appointments.models import Appointment, Notification
from patients.models import PatientProfile
from patients.serializers import PatientSerializer
from resources.models import Room, Equipment
from resources.serializers import RoomSerializer, EquipmentSerializer
from staff.models import ProfessionalProfile
from staff.serializers import ProfessionalSerializer


class AppointmentSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=PatientProfile.objects.all(),
        source='patient',
        write_only=True,
    )
    professional = ProfessionalSerializer(read_only=True)
    professional_id = serializers.PrimaryKeyRelatedField(
        queryset=ProfessionalProfile.objects.all(),
        source='professional',
        write_only=True,
    )
    room = RoomSerializer(read_only=True)
    room_id = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.all(),
        source='room',
        write_only=True,
        required=False,
        allow_null=True,
    )
    equipment = EquipmentSerializer(many=True, read_only=True)
    equipment_ids = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.all(),
        many=True,
        source='equipment',
        write_only=True,
        required=False,
    )
    end_time = serializers.DateTimeField(required=False, allow_null=True)

    class Meta:
        model = Appointment
        fields = [
            'id',
            'patient',
            'patient_id',
            'professional',
            'professional_id',
            'room',
            'room_id',
            'equipment',
            'equipment_ids',
            'start_time',
            'end_time',
            'status',
            'treatment_type',
            'notes',
            'version',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ('version', 'created_at', 'updated_at')

    def validate_start_time(self, value):
        """Validar que la fecha de inicio no sea en el pasado ni más de 3 meses en el futuro"""
        from django.utils import timezone
        
        if value:
            now = timezone.now()
            
            # No puede ser en el pasado
            if value < now:
                raise serializers.ValidationError('La fecha seleccionada no es válida.')
            
            # No puede ser más de 3 meses en el futuro
            from datetime import timedelta
            max_date = now + timedelta(days=90)  # Aproximadamente 3 meses
            
            if value > max_date:
                raise serializers.ValidationError('La fecha seleccionada no es válida.')
        
        return value

    def validate(self, attrs):
        # Validación de bloqueo optimista
        if self.instance:
            version = attrs.get('version')
            if version and version != self.instance.version:
                raise serializers.ValidationError({
                    'version': 'La cita ha sido modificada por otro usuario. Por favor, recargue la información.'
                })

        start = attrs.get('start_time')
        end = attrs.get('end_time')
        
        # Si no se proporciona end_time, calcularlo automáticamente (+1 hora desde start_time)
        if not end:
            from datetime import timedelta
            from django.utils.dateparse import parse_datetime
            
            # Determinar el start_time a usar
            if start:
                if isinstance(start, str):
                    start_parsed = parse_datetime(start)
                else:
                    start_parsed = start
            elif self.instance and self.instance.start_time:
                start_parsed = self.instance.start_time
            else:
                start_parsed = None
            
            # Calcular end_time si tenemos start_time
            if start_parsed:
                end = start_parsed + timedelta(hours=1)
                attrs['end_time'] = end
            elif not self.instance:
                # Si es una creación nueva y no hay start_time, no podemos calcular end_time
                # pero esto se validará más abajo
                pass
        
        # Validar que end_time > start_time
        start = attrs.get('start_time') or (self.instance.start_time if self.instance else None)
        end = attrs.get('end_time') or (self.instance.end_time if self.instance else None)
        
        if start and end:
            from django.utils.dateparse import parse_datetime
            if isinstance(end, str):
                end = parse_datetime(end)
            if isinstance(start, str):
                start = parse_datetime(start)
            if end and start and end <= start:
                raise serializers.ValidationError('La hora de fin debe ser posterior a la de inicio.')

        professional = attrs.get('professional') or getattr(self.instance, 'professional', None)
        room = attrs.get('room') or getattr(self.instance, 'room', None)
        
        # Si falta professional, room, start o end, retornar attrs (se validará en perform_create o en el modelo)
        if not (professional and start and end):
            return attrs
        
        # Validación de solapamiento con bloqueo pesimista implícito (unique constraints)
        overlapping = Appointment.objects.filter(
            professional=professional,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
            start_time__lt=end,
            end_time__gt=start,
        )
        if self.instance:
            overlapping = overlapping.exclude(pk=self.instance.pk)
        if overlapping.exists():
            raise serializers.ValidationError('El profesional ya tiene una cita asignada en ese horario.')

        # Solo validar solapamiento de sala si se proporciona room
        if room:
            overlapping_room = Appointment.objects.filter(
                room=room,
                status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
                start_time__lt=end,
                end_time__gt=start,
            )
            if self.instance:
                overlapping_room = overlapping_room.exclude(pk=self.instance.pk)
            if overlapping_room.exists():
                raise serializers.ValidationError('La sala no está disponible en ese horario.')

        return attrs


class NotificationSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'appointment',
            'patient',
            'notification_type',
            'channel',
            'title',
            'message',
            'sent_at',
            'read_at',
            'created_at',
        ]
        read_only_fields = ('sent_at', 'read_at', 'created_at')

