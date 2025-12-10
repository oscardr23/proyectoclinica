from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Room, Equipment
from .serializers import RoomSerializer, EquipmentSerializer
from users.permissions import IsAdmin, IsProfessionalOrAdmin


class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        return [permissions.IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        """Eliminar una sala, verificando primero si tiene citas asociadas"""
        room = self.get_object()
        
        # Verificar si hay citas asociadas a esta sala
        from appointments.models import Appointment
        
        appointments_count = Appointment.objects.filter(room=room).count()
        
        if appointments_count > 0:
            return Response(
                {
                    'detail': 'No se puede eliminar esta sala porque tiene citas asociadas.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Si no hay citas, proceder con la eliminación
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def availability(self, request, pk=None):
        """Consultar disponibilidad de una sala"""
        room = self.get_object()
        date = request.query_params.get('date')
        
        if not date:
            return Response({'error': 'Se requiere el parámetro date'}, status=400)
        
        from appointments.models import Appointment
        
        occupied = Appointment.objects.filter(
            room=room,
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
        
        return Response({'occupied_slots': occupied_slots})


class EquipmentViewSet(viewsets.ModelViewSet):
    queryset = Equipment.objects.select_related('room')
    serializer_class = EquipmentSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = self.queryset
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        room_id = self.request.query_params.get('room_id')
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        return queryset
