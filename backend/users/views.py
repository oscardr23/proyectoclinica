from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import IsAdmin
from .serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    MeSerializer,
    PatientRegistrationSerializer,
    UserSerializer,
)
from .utils import verify_password

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activar un usuario"""
        user = self.get_object()
        user.is_active = True
        user.save()
        return Response({'status': 'activated'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Desactivar un usuario (no eliminar)"""
        user = self.get_object()
        if user == request.user:
            return Response(
                {'error': 'No puede desactivar su propia cuenta'},
                status=status.HTTP_400_BAD_REQUEST
            )
        user.is_active = False
        user.save()
        return Response({'status': 'deactivated'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def change_role(self, request, pk=None):
        """Cambiar el rol de un usuario (solo admin)"""
        user = self.get_object()
        new_role = request.data.get('role')
        
        if not new_role:
            return Response(
                {'error': 'Se requiere el campo "role"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if new_role not in [User.Roles.PATIENT, User.Roles.PROFESSIONAL, User.Roles.ADMIN]:
            return Response(
                {'error': 'Rol inválido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # No permitir cambiar el rol del propio usuario admin
        if user == request.user and new_role != User.Roles.ADMIN:
            return Response(
                {'error': 'No puede cambiar su propio rol de administrador'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.role = new_role
        user.save()
        return Response({'status': 'role_changed', 'new_role': new_role}, status=status.HTTP_200_OK)

    def perform_destroy(self, instance):
        """Sobrescribir para evitar eliminación física de datos históricos"""
        # En lugar de eliminar, desactivar
        instance.is_active = False
        instance.save()

    @action(detail=True, methods=['post'])
    def verify_password(self, request, pk=None):
        """Verificar si una contraseña coincide con el hash almacenado"""
        user = self.get_object()
        password = request.data.get('password')
        
        if not password:
            return Response(
                {'error': 'Se requiere el campo "password"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        is_valid = user.check_password(password)
        return Response({
            'valid': is_valid,
            'user_id': user.id,
            'username': user.username
        }, status=status.HTTP_200_OK)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.UpdateAPIView):
    """Vista para cambiar contraseña"""
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = self.get_object()
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'status': 'password changed'}, status=status.HTTP_200_OK)


class PatientRegistrationView(generics.CreateAPIView):
    serializer_class = PatientRegistrationSerializer
    permission_classes = [permissions.AllowAny]


class CustomTokenObtainPairView(TokenObtainPairView):
    """Vista personalizada que permite login con username o email"""
    serializer_class = CustomTokenObtainPairSerializer
