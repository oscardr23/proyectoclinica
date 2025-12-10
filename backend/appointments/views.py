from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import Appointment, Notification
from .serializers import AppointmentSerializer, NotificationSerializer


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Crear el queryset base cada vez para evitar problemas de cache
        queryset = Appointment.objects.select_related(
            'patient__user',
            'professional__user',
            'room',
        ).prefetch_related('equipment').all()
        
        user = self.request.user
        
        # Filtros opcionales
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        date_from = self.request.query_params.get('date_from')
        if date_from:
            queryset = queryset.filter(start_time__gte=date_from)
        
        date_to = self.request.query_params.get('date_to')
        if date_to:
            queryset = queryset.filter(start_time__lte=date_to)
        
        # Filtrado por rol
        if user.role == user.Roles.PATIENT:
            return queryset.filter(patient__user=user)
        if user.role == user.Roles.PROFESSIONAL:
            return queryset.filter(professional__user=user)
        # ADMIN ve todas las citas
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        extra = {'created_by': user}
        
        if user.role == user.Roles.PATIENT:
            patient_profile = getattr(user, 'patient_profile', None)
            if not patient_profile:
                raise PermissionDenied('El paciente no tiene perfil asociado.')
            extra['patient'] = patient_profile
            extra['status'] = Appointment.Status.PENDING
            
            # Si no se proporciona room_id, asignar una sala por defecto (primera sala activa)
            if 'room' not in serializer.validated_data or serializer.validated_data.get('room') is None:
                from resources.models import Room
                default_room = Room.objects.filter(is_active=True).first()
                if default_room:
                    extra['room'] = default_room
                else:
                    raise ValidationError('No hay salas disponibles. Por favor, contacte con el administrador.')
        
        if user.role == user.Roles.PROFESSIONAL and 'professional' not in serializer.validated_data:
            professional_profile = getattr(user, 'professional_profile', None)
            if professional_profile:
                extra['professional'] = professional_profile
        
        appointment = serializer.save(**extra)
        
        # Crear notificación para paciente
        if user.role == user.Roles.PATIENT:
            Notification.objects.create(
                appointment=appointment,
                patient=appointment.patient,
                notification_type=Notification.NotificationType.APPOINTMENT_REMINDER,
                title='Cita solicitada',
                message=f'Su cita para {appointment.treatment_type} ha sido solicitada y está pendiente de aprobación.',
            )

    @transaction.atomic
    def perform_update(self, serializer):
        user = self.request.user
        appointment = self.get_object()
        
        # Validación de bloqueo optimista
        if 'version' in serializer.validated_data:
            if serializer.validated_data['version'] != appointment.version:
                raise ValidationError({
                    'version': 'La cita ha sido modificada por otro usuario. Por favor, recargue la información.'
                })
        
        # Restricciones para pacientes
        if user.role == user.Roles.PATIENT:
            if appointment.patient.user != user:
                raise PermissionDenied('Solo puede modificar sus propias citas.')
            
            # Pacientes solo pueden cancelar
            new_status = serializer.validated_data.get('status')
            if new_status and new_status != Appointment.Status.CANCELLED:
                raise PermissionDenied('Un paciente solo puede cancelar su cita.')
            
            # Validar 24h de antelación
            if new_status == Appointment.Status.CANCELLED:
                can_cancel, error = appointment.can_be_cancelled(user)
                if not can_cancel:
                    raise ValidationError({'status': error})
        
        old_status = appointment.status
        serializer.save()
        appointment.refresh_from_db()
        
        # Crear notificación si cambió el estado
        if old_status != appointment.status:
            if appointment.status == Appointment.Status.CONFIRMED:
                Notification.objects.create(
                    appointment=appointment,
                    patient=appointment.patient,
                    notification_type=Notification.NotificationType.APPOINTMENT_CONFIRMED,
                    title='Cita confirmada',
                    message=f'Su cita para {appointment.treatment_type} el {appointment.start_time.strftime("%d/%m/%Y %H:%M")} ha sido confirmada.',
                )
            elif appointment.status == Appointment.Status.CANCELLED:
                Notification.objects.create(
                    appointment=appointment,
                    patient=appointment.patient,
                    notification_type=Notification.NotificationType.APPOINTMENT_CANCELLED,
                    title='Cita cancelada',
                    message=f'Su cita para {appointment.treatment_type} ha sido cancelada.',
                )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Aprobar una cita pendiente"""
        appointment = self.get_object()
        if request.user.role not in [request.user.Roles.ADMIN, request.user.Roles.PROFESSIONAL]:
            raise PermissionDenied('No autorizado para aprobar citas.')
        
        if appointment.status != Appointment.Status.PENDING:
            raise ValidationError('Solo se pueden aprobar citas pendientes.')
        
        appointment.status = Appointment.Status.CONFIRMED
        appointment.save(update_fields=['status'])
        
        # Crear notificación
        Notification.objects.create(
            appointment=appointment,
            patient=appointment.patient,
            notification_type=Notification.NotificationType.APPOINTMENT_CONFIRMED,
            title='Cita confirmada',
            message=f'Su cita para {appointment.treatment_type} el {appointment.start_time.strftime("%d/%m/%Y %H:%M")} ha sido confirmada.',
        )
        
        return Response({'status': 'approved'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancelar una cita con validaciones"""
        appointment = self.get_object()
        user = request.user
        
        # Verificar permisos
        if user.role == user.Roles.PATIENT and appointment.patient.user != user:
            raise PermissionDenied('Solo puede cancelar sus propias citas.')
        
        reason = request.data.get('reason', '')
        
        try:
            appointment.cancel(user, reason)
            
            # Crear notificación
            Notification.objects.create(
                appointment=appointment,
                patient=appointment.patient,
                notification_type=Notification.NotificationType.APPOINTMENT_CANCELLED,
                title='Cita cancelada',
                message=f'Su cita para {appointment.treatment_type} ha sido cancelada.',
            )
            
            return Response({'status': 'cancelled'}, status=status.HTTP_200_OK)
        except ValidationError as e:
            raise ValidationError({'error': str(e)})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Marcar una cita como completada"""
        appointment = self.get_object()
        if request.user.role not in [request.user.Roles.ADMIN, request.user.Roles.PROFESSIONAL]:
            raise PermissionDenied('No autorizado para completar citas.')
        
        appointment.status = Appointment.Status.COMPLETED
        appointment.save(update_fields=['status'])
        
        return Response({'status': 'completed'}, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """Eliminar una cita, pero no permitir eliminar citas pasadas"""
        appointment = self.get_object()
        
        # Verificar si la cita ya pasó
        if appointment.start_time < timezone.now():
            return Response(
                {
                    'detail': 'No se puede eliminar una cita que ya se ha realizado. Las citas pasadas se conservan para mantener el historial.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Si la cita es futura, proceder con la eliminación
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def availability(self, request):
        """Consultar disponibilidad de profesionales y salas"""
        professional_id = request.query_params.get('professional_id')
        room_id = request.query_params.get('room_id')
        date = request.query_params.get('date')
        
        if not date:
            return Response({'error': 'Se requiere el parámetro date'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Obtener citas ocupadas
        occupied = Appointment.objects.filter(
            start_time__date=date,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
        )
        
        if professional_id:
            occupied = occupied.filter(professional_id=professional_id)
        
        if room_id:
            occupied = occupied.filter(room_id=room_id)
        
        # Retornar horarios ocupados
        occupied_slots = [
            {
                'start': apt.start_time.isoformat(),
                'end': apt.end_time.isoformat(),
            }
            for apt in occupied
        ]
        
        return Response({'occupied_slots': occupied_slots})


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == user.Roles.PATIENT:
            patient_profile = getattr(user, 'patient_profile', None)
            if patient_profile:
                return Notification.objects.filter(patient=patient_profile)
            return Notification.objects.none()
        # Profesionales y admins ven todas las notificaciones
        return Notification.objects.all()

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Marcar una notificación como leída"""
        notification = self.get_object()
        notification.read_at = timezone.now()
        notification.save(update_fields=['read_at'])
        return Response({'status': 'read'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Marcar todas las notificaciones como leídas"""
        queryset = self.get_queryset()
        queryset.filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({'status': 'all_read'}, status=status.HTTP_200_OK)
