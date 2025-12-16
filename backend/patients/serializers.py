import re
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError as DRFValidationError

from .models import PatientProfile, ClinicalRecord, Document, EditLock
from users.serializers import UserSerializer

User = get_user_model()


class PatientSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user',
        write_only=True,
        required=False,
    )
    # Campos para crear usuario y perfil juntos
    first_name = serializers.CharField(write_only=True, required=False)
    last_name = serializers.CharField(write_only=True, required=False)
    email = serializers.EmailField(write_only=True, required=False)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    document_id = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate_phone(self, value):
        """Validar que el teléfono solo contenga números"""
        if value and not re.match(r'^[0-9]+$', value):
            raise serializers.ValidationError('El teléfono solo puede contener números.')
        return value

    def validate_document_id(self, value):
        """Validar formato de DNI/NIE"""
        if not value:
            return value
        
        value = value.strip().upper()
        # Validar formato DNI: 8 números + 1 letra
        dni_pattern = re.compile(r'^[0-9]{8}[A-Z]$')
        # Validar formato NIE: X/Y/Z + 7 números + 1 letra
        nie_pattern = re.compile(r'^[XYZ][0-9]{7}[A-Z]$')
        
        if not dni_pattern.match(value) and not nie_pattern.match(value):
            raise serializers.ValidationError('Formato de DNI/NIE inválido. Use: 12345678A (DNI) o X1234567L (NIE)')
        
        # Validar letra del DNI
        if dni_pattern.match(value):
            numbers = value[:8]
            letter = value[8]
            valid_letters = 'TRWAGMYFPDXBNJZSQVHLCKE'
            expected_letter = valid_letters[int(numbers) % 23]
            if letter != expected_letter:
                raise serializers.ValidationError('La letra del DNI no es correcta')
        
        # Verificar que no exista otro usuario con el mismo DNI que tenga un perfil de paciente activo
        # Solo verificar usuarios que tengan un PatientProfile asociado (pacientes activos)
        # Excluir el usuario actual si se está actualizando
        query = User.objects.filter(document_id=value).filter(patient_profile__isnull=False)
        if self.instance and self.instance.user:
            query = query.exclude(id=self.instance.user.id)
        
        if query.exists():
            raise serializers.ValidationError('Ya existe un paciente con este DNI/NIE')
        
        return value

    def validate_date_of_birth(self, value):
        """Validar que la fecha de nacimiento sea razonable (no en el futuro y no antes de 1900)"""
        if value:
            from django.utils import timezone
            from datetime import date
            
            today = timezone.now().date()
            min_date = date(1900, 1, 1)
            
            if value > today:
                raise serializers.ValidationError('La fecha de nacimiento no puede ser en el futuro')
            if value < min_date:
                raise serializers.ValidationError('La fecha de nacimiento no puede ser anterior a 1900')
        return value

    # Campo para optimistic locking
    _updated_at = serializers.DateTimeField(write_only=True, required=False, help_text="Timestamp de última actualización para control de concurrencia")
    
    class Meta:
        model = PatientProfile
        fields = [
            'id',
            'user',
            'user_id',
            'first_name',
            'last_name',
            'email',
            'phone',
            'document_id',
            'date_of_birth',
            'allergies',
            'medical_notes',
            'emergency_contact',
            'insurance_provider',
            'created_at',
            'updated_at',
            '_updated_at',
        ]
        read_only_fields = ('created_at', 'updated_at')

    def create(self, validated_data):
        # Si se proporcionan datos de usuario, crear usuario y perfil juntos
        if 'first_name' in validated_data or 'email' in validated_data:
            email = validated_data.pop('email', '')
            user_data = {
                'username': email,
                'email': email,
                'first_name': validated_data.pop('first_name', ''),
                'last_name': validated_data.pop('last_name', ''),
                'phone': validated_data.pop('phone', ''),
                'document_id': validated_data.pop('document_id', ''),
                'role': User.Roles.PATIENT,
            }
            # Usar contraseña por defecto "1234" si no se proporciona
            password = validated_data.pop('password', None) or '1234'
            user = User.objects.create_user(password=password, **user_data)
            validated_data['user'] = user
        elif 'user_id' not in validated_data:
            raise serializers.ValidationError('Debe proporcionar user_id o datos para crear un nuevo usuario.')
        
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Validar optimistic locking si se proporciona _updated_at
        updated_at_timestamp = validated_data.pop('_updated_at', None)
        if updated_at_timestamp:
            # Convertir a datetime si es string
            if isinstance(updated_at_timestamp, str):
                from django.utils.dateparse import parse_datetime
                updated_at_timestamp = parse_datetime(updated_at_timestamp)
            
            # Verificar si el registro fue modificado desde que se cargó
            if instance.updated_at and updated_at_timestamp:
                # Comparar timestamps (con margen de 1 segundo para diferencias de precisión)
                time_diff = abs((instance.updated_at - updated_at_timestamp).total_seconds())
                if time_diff > 1:
                    raise DRFValidationError({
                        'error': 'El registro ha sido modificado por otro usuario. Por favor, recarga la página y vuelve a intentarlo.',
                        'current_updated_at': instance.updated_at.isoformat(),
                        'provided_updated_at': updated_at_timestamp.isoformat() if hasattr(updated_at_timestamp, 'isoformat') else str(updated_at_timestamp),
                    })
        
        # Verificar si hay un bloqueo activo de otro usuario
        try:
            lock = EditLock.objects.get(patient=instance)
            if lock.is_valid() and lock.locked_by != self.context['request'].user:
                raise DRFValidationError({
                    'error': f'El paciente está siendo editado por {lock.locked_by.get_full_name() or lock.locked_by.username}. Por favor, espera a que termine.',
                    'locked_by': lock.locked_by.get_full_name() or lock.locked_by.username,
                    'locked_at': lock.locked_at.isoformat(),
                })
        except EditLock.DoesNotExist:
            pass
        
        # Extraer campos del usuario si están presentes
        user_data = {}
        if 'phone' in validated_data:
            user_data['phone'] = validated_data.pop('phone')
        if 'email' in validated_data:
            user_data['email'] = validated_data.pop('email')
        if 'first_name' in validated_data:
            user_data['first_name'] = validated_data.pop('first_name')
        if 'last_name' in validated_data:
            user_data['last_name'] = validated_data.pop('last_name')
        if 'document_id' in validated_data:
            user_data['document_id'] = validated_data.pop('document_id')
        
        # Actualizar el usuario si hay datos
        if user_data and instance.user:
            for key, value in user_data.items():
                setattr(instance.user, key, value)
            instance.user.save()
        
        # Actualizar el perfil del paciente
        result = super().update(instance, validated_data)
        
        # Limpiar bloqueos expirados después de actualizar
        EditLock.cleanup_expired()
        
        return result


class ClinicalRecordSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=PatientProfile.objects.all(),
        source='patient',
        write_only=True,
    )
    professional_name = serializers.CharField(source='professional.user.get_full_name', read_only=True)

    class Meta:
        model = ClinicalRecord
        fields = [
            'id',
            'patient',
            'patient_id',
            'appointment',
            'professional',
            'professional_name',
            'treatment',
            'notes',
            'diagnosis',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ('created_at', 'updated_at')


class DocumentSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=PatientProfile.objects.all(),
        source='patient',
        write_only=True,
    )
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id',
            'patient',
            'patient_id',
            'document_type',
            'title',
            'file',
            'file_url',
            'description',
            'uploaded_by',
            'uploaded_by_name',
            'uploaded_at',
        ]
        read_only_fields = ('uploaded_at',)

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
        return None

