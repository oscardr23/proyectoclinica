from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from django.utils import timezone

from .models import PatientProfile, ClinicalRecord, Document, EditLock
from .serializers import PatientSerializer, ClinicalRecordSerializer, DocumentSerializer
from users.permissions import IsAdmin, IsProfessionalOrAdmin


class PatientViewSet(viewsets.ModelViewSet):
    serializer_class = PatientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == user.Roles.PATIENT:
            return PatientProfile.objects.filter(user=user)
        # Profesionales y admins ven todos los pacientes
        return PatientProfile.objects.select_related('user').all()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if self.action == 'create':
                # Cualquiera puede crear su propio perfil
                return [permissions.IsAuthenticated()]
            # Solo profesionales y admins pueden modificar pacientes
            return [IsProfessionalOrAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == user.Roles.PATIENT:
            serializer.save(user=user)
        else:
            serializer.save()
    
    def update(self, request, *args, **kwargs):
        """Sobrescribir update para desbloquear después de actualizar"""
        response = super().update(request, *args, **kwargs)
        
        # Desbloquear el paciente después de una actualización exitosa
        if response.status_code == status.HTTP_200_OK:
            patient = self.get_object()
            try:
                lock = EditLock.objects.get(patient=patient, locked_by=request.user)
                lock.delete()
            except EditLock.DoesNotExist:
                pass
        
        return response
    
    def partial_update(self, request, *args, **kwargs):
        """Sobrescribir partial_update para desbloquear después de actualizar"""
        response = super().partial_update(request, *args, **kwargs)
        
        # Desbloquear el paciente después de una actualización exitosa
        if response.status_code == status.HTTP_200_OK:
            patient = self.get_object()
            try:
                lock = EditLock.objects.get(patient=patient, locked_by=request.user)
                lock.delete()
            except EditLock.DoesNotExist:
                pass
        
        return response

    @action(detail=True, methods=['get'])
    def clinical_history(self, request, pk=None):
        """Obtener historial clínico de un paciente"""
        patient = self.get_object()
        user = request.user
        
        # Verificar permisos
        if user.role == user.Roles.PATIENT and patient.user != user:
            raise PermissionDenied('Solo puede ver su propio historial clínico.')
        
        records = ClinicalRecord.objects.filter(patient=patient).select_related(
            'professional__user',
            'appointment',
        )
        
        serializer = ClinicalRecordSerializer(records, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def documents(self, request, pk=None):
        """Obtener documentos de un paciente"""
        patient = self.get_object()
        user = request.user
        
        # Verificar permisos
        if user.role == user.Roles.PATIENT and patient.user != user:
            raise PermissionDenied('Solo puede ver sus propios documentos.')
        
        documents = Document.objects.filter(patient=patient).select_related('uploaded_by')
        serializer = DocumentSerializer(documents, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        """Bloquear un paciente para edición"""
        patient = self.get_object()
        user = request.user
        
        # Solo profesionales y admins pueden bloquear
        if not (user.is_professional() or user.is_admin()):
            raise PermissionDenied('Solo los profesionales pueden bloquear pacientes para edición.')
        
        # Limpiar bloqueos expirados primero
        EditLock.cleanup_expired()
        
        # Intentar crear o actualizar el bloqueo
        try:
            lock = EditLock.objects.get(patient=patient)
            if lock.is_valid() and lock.locked_by != user:
                return Response({
                    'error': f'El paciente está siendo editado por {lock.locked_by.get_full_name() or lock.locked_by.username}',
                    'locked_by': lock.locked_by.get_full_name() or lock.locked_by.username,
                    'locked_by_id': lock.locked_by.id,
                    'locked_at': lock.locked_at.isoformat(),
                    'expires_at': lock.expires_at.isoformat(),
                }, status=status.HTTP_409_CONFLICT)
            elif lock.is_valid() and lock.locked_by == user:
                # Extender el bloqueo existente
                lock.extend(minutes=15)
        except EditLock.DoesNotExist:
            # Crear nuevo bloqueo
            lock = EditLock.create_or_update(patient, user, minutes=15)
        
        return Response({
            'message': 'Paciente bloqueado para edición',
            'locked_by': user.get_full_name() or user.username,
            'locked_at': lock.locked_at.isoformat(),
            'expires_at': lock.expires_at.isoformat(),
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def unlock(self, request, pk=None):
        """Desbloquear un paciente"""
        patient = self.get_object()
        user = request.user
        
        try:
            lock = EditLock.objects.get(patient=patient)
            # Solo el usuario que bloqueó o un admin puede desbloquear
            if lock.locked_by != user and not user.is_admin():
                raise PermissionDenied('Solo el usuario que bloqueó el paciente o un administrador puede desbloquearlo.')
            lock.delete()
            return Response({
                'message': 'Paciente desbloqueado',
            }, status=status.HTTP_200_OK)
        except EditLock.DoesNotExist:
            return Response({
                'message': 'El paciente no está bloqueado',
            }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get'])
    def lock_status(self, request, pk=None):
        """Obtener el estado del bloqueo de un paciente"""
        patient = self.get_object()
        
        # Limpiar bloqueos expirados primero
        EditLock.cleanup_expired()
        
        try:
            lock = EditLock.objects.get(patient=patient)
            if lock.is_valid():
                return Response({
                    'is_locked': True,
                    'locked_by': lock.locked_by.get_full_name() or lock.locked_by.username,
                    'locked_by_id': lock.locked_by.id,
                    'locked_at': lock.locked_at.isoformat(),
                    'expires_at': lock.expires_at.isoformat(),
                    'is_current_user': lock.locked_by == request.user,
                })
            else:
                # Bloqueo expirado, eliminarlo
                lock.delete()
                return Response({
                    'is_locked': False,
                })
        except EditLock.DoesNotExist:
            return Response({
                'is_locked': False,
            })


class ClinicalRecordViewSet(viewsets.ModelViewSet):
    serializer_class = ClinicalRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = ClinicalRecord.objects.select_related(
            'patient__user',
            'professional__user',
            'appointment',
        )
        
        if user.role == user.Roles.PATIENT:
            patient_profile = getattr(user, 'patient_profile', None)
            if patient_profile:
                return queryset.filter(patient=patient_profile)
            return queryset.none()
        
        # Profesionales y admins ven todos los registros
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        
        return queryset

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Solo profesionales y admins pueden crear/modificar registros
            return [IsProfessionalOrAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        user = self.request.user
        professional_profile = getattr(user, 'professional_profile', None)
        if professional_profile:
            serializer.save(professional=professional_profile)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Document.objects.select_related('patient__user', 'uploaded_by')
        
        if user.role == user.Roles.PATIENT:
            patient_profile = getattr(user, 'patient_profile', None)
            if patient_profile:
                return queryset.filter(patient=patient_profile)
            return queryset.none()
        
        # Profesionales y admins ven todos los documentos
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        
        return queryset

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Solo profesionales y admins pueden gestionar documentos
            return [IsProfessionalOrAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
