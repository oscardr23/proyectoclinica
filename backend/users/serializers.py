from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from patients.models import PatientProfile
from .utils import validate_password_strength

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'phone',
            'document_id',
            'is_active',
            'date_joined',
        ]
        read_only_fields = ('id', 'date_joined')


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'phone',
            'document_id',
            'role',
        ]
        read_only_fields = ('id', 'username', 'role')


class PatientRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone = serializers.CharField(required=False, allow_blank=True)
    document_id = serializers.CharField(required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('El email ya está registrado.')
        return value

    def validate_password(self, value):
        is_valid, errors = validate_password_strength(value)
        if not is_valid:
            raise serializers.ValidationError('; '.join(errors))
        return value

    def create(self, validated_data):
        patient_fields = {
            'date_of_birth': validated_data.pop('date_of_birth', None),
        }
        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone=validated_data.get('phone', ''),
            document_id=validated_data.get('document_id', ''),
            role=User.Roles.PATIENT,
        )
        PatientProfile.objects.create(
            user=user,
            date_of_birth=patient_fields.get('date_of_birth'),
        )
        return user


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer para cambio de contraseña"""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('La contraseña actual es incorrecta.')
        return value

    def validate_new_password(self, value):
        is_valid, errors = validate_password_strength(value)
        if not is_valid:
            raise serializers.ValidationError('; '.join(errors))
        old_password = self.initial_data.get('old_password')
        if value == old_password:
            raise serializers.ValidationError('La nueva contraseña debe ser diferente a la actual.')
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Serializer que permite login con username o email"""
    username_field = 'username'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Hacer username opcional y agregar campo email
        self.fields['username'] = serializers.CharField(required=False, allow_blank=True)
        self.fields['email'] = serializers.EmailField(required=False, allow_blank=True)

    def validate(self, attrs):
        username = attrs.get('username', '').strip()
        email = attrs.get('email', '').strip()
        password = attrs.get('password')

        if not password:
            raise serializers.ValidationError('La contraseña es requerida.')

        # Si se proporciona email explícitamente, buscar el username correspondiente
        if email and not username:
            try:
                user = User.objects.get(email=email)
                username = user.username
            except User.DoesNotExist:
                raise serializers.ValidationError('No se encontró un usuario con ese email.')
        
        # Si username parece un email (contiene @), intentar buscar por email
        elif username and '@' in username:
            try:
                user = User.objects.get(email=username)
                username = user.username
            except User.DoesNotExist:
                # Si no se encuentra por email, intentar autenticar con el username tal cual
                pass

        if not username:
            raise serializers.ValidationError('Debe proporcionar username o email.')

        # Usar el username para autenticar (el padre espera 'username')
        attrs['username'] = username
        attrs.pop('email', None)  # Eliminar email de attrs antes de pasar al padre

        return super().validate(attrs)

