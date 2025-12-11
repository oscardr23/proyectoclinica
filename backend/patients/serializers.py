import re
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework import serializers

from .models import PatientProfile, ClinicalRecord, Document
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
        return super().update(instance, validated_data)


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

