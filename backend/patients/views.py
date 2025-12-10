from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import PatientProfile, ClinicalRecord, Document
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
