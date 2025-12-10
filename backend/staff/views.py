from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ProfessionalProfile
from .serializers import ProfessionalSerializer
from users.permissions import IsAdmin, IsProfessionalOrAdmin


class ProfessionalViewSet(viewsets.ModelViewSet):
    queryset = ProfessionalProfile.objects.select_related('user').all()
    serializer_class = ProfessionalSerializer

    def get_permissions(self):
        if self.action in ['create', 'destroy']:
            # Solo admins pueden crear o eliminar profesionales
            return [IsAdmin()]
        if self.action in ['update', 'partial_update']:
            # Profesionales pueden actualizar sus propios datos, admins pueden actualizar cualquiera
            return [IsProfessionalOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role == user.Roles.PROFESSIONAL:
            # Profesionales solo ven su propio perfil
            return ProfessionalProfile.objects.filter(user=user)
        # Admins ven todos los profesionales
        return super().get_queryset()

    def perform_update(self, serializer):
        user = self.request.user
        professional = self.get_object()
        
        # Si es profesional, solo puede actualizar su propio perfil
        if user.role == user.Roles.PROFESSIONAL and professional.user != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo puede modificar su propio perfil profesional.')
        
        serializer.save()

    @action(detail=True, methods=['get'])
    def availability(self, request, pk=None):
        """Consultar disponibilidad de un profesional"""
        professional = self.get_object()
        date = request.query_params.get('date')
        
        if not date:
            return Response({'error': 'Se requiere el parámetro date'}, status=status.HTTP_400_BAD_REQUEST)
        
        from appointments.models import Appointment
        
        occupied = Appointment.objects.filter(
            professional=professional,
            start_time__date=date,
            status__in=['PENDING', 'CONFIRMED'],
        )
        
        occupied_slots = [
            {
                'start': apt.start_time.isoformat(),
                'end': apt.end_time.isoformat(),
            }
            for apt in occupied
        ]
        
        return Response({
            'professional': professional.user.get_full_name(),
            'working_days': professional.working_days,
            'start_hour': professional.start_hour.isoformat() if professional.start_hour else None,
            'end_hour': professional.end_hour.isoformat() if professional.end_hour else None,
            'occupied_slots': occupied_slots,
        })
