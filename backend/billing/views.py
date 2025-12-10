from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Service, Invoice, InvoiceItem, Budget
from .serializers import ServiceSerializer, InvoiceSerializer, BudgetSerializer
from users.permissions import IsAdmin, IsProfessionalOrAdmin


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.filter(is_active=True)
    serializer_class = ServiceSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        return [permissions.IsAuthenticated()]


class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Invoice.objects.select_related('patient__user', 'issued_by')
        
        if user.role == user.Roles.PATIENT:
            patient_profile = getattr(user, 'patient_profile', None)
            if patient_profile:
                return queryset.filter(patient=patient_profile)
            return queryset.none()
        
        # Profesionales y admins ven todas las facturas
        status_filter = self.request.query_params.get('status')
        if status_filter:
            if status_filter == 'OVERDUE':
                # Filtrar facturas vencidas (SENT con due_date pasado)
                from django.utils import timezone
                queryset = queryset.filter(
                    status=Invoice.Status.SENT,
                    due_date__lt=timezone.now().date()
                )
            else:
                queryset = queryset.filter(status=status_filter)
        
        return queryset

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(issued_by=self.request.user)

    def perform_update(self, serializer):
        """Actualizar factura con lógica adicional"""
        invoice = serializer.save()
        # Si se cambia el estado a SENT y no hay due_date, establecer 30 días
        if invoice.status == Invoice.Status.SENT and not invoice.due_date:
            from datetime import timedelta
            invoice.due_date = invoice.issued_at + timedelta(days=30)
            invoice.save(update_fields=['due_date'])

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Marcar una factura como pagada"""
        invoice = self.get_object()
        if request.user.role not in [request.user.Roles.ADMIN, request.user.Roles.PROFESSIONAL]:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        
        invoice.status = Invoice.Status.PAID
        invoice.save(update_fields=['status'])
        return Response({'status': 'paid'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Generar y descargar PDF de la factura"""
        from django.http import HttpResponse
        from io import BytesIO
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT
        
        invoice = self.get_object()
        
        # Verificar permisos
        if request.user.role == request.user.Roles.PATIENT:
            patient_profile = getattr(request.user, 'patient_profile', None)
            if not patient_profile or invoice.patient != patient_profile:
                return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        
        # Crear PDF en memoria
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        elements = []
        styles = getSampleStyleSheet()
        
        # Estilos personalizados
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.HexColor('#667eea'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        # Título
        elements.append(Paragraph('FACTURA', title_style))
        elements.append(Spacer(1, 0.5*cm))
        
        # Información de la factura
        status_labels = {
            Invoice.Status.DRAFT: 'Borrador',
            Invoice.Status.SENT: 'Enviada',
            Invoice.Status.PAID: 'Pagada',
            Invoice.Status.CANCELLED: 'Cancelada',
            Invoice.Status.OVERDUE: 'Vencida',
        }
        invoice_data = [
            ['Nº Factura:', f'FAC-{invoice.id:04d}'],
            ['Fecha:', invoice.issued_at.strftime('%d/%m/%Y')],
            ['Estado:', status_labels.get(invoice.status, invoice.status)],
        ]
        if invoice.due_date:
            invoice_data.append(['Vencimiento:', invoice.due_date.strftime('%d/%m/%Y')])
        
        invoice_table = Table(invoice_data, colWidths=[4*cm, 10*cm])
        invoice_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f4ff')),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#667eea')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(invoice_table)
        elements.append(Spacer(1, 0.5*cm))
        
        # Información del paciente
        patient_data = [
            ['Paciente:', f"{invoice.patient.user.first_name} {invoice.patient.user.last_name}"],
            ['Email:', invoice.patient.user.email or ''],
            ['Teléfono:', invoice.patient.user.phone or ''],
        ]
        if invoice.patient.user.document_id:
            patient_data.append(['DNI/NIE:', invoice.patient.user.document_id])
        
        patient_table = Table(patient_data, colWidths=[4*cm, 10*cm])
        patient_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f4ff')),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#667eea')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(patient_table)
        elements.append(Spacer(1, 1*cm))
        
        # Items de la factura
        items_data = [['Servicio', 'Cantidad', 'Precio Unit.', 'Total']]
        for item in invoice.items.all():
            items_data.append([
                item.service.name,
                str(item.quantity),
                f'{item.unit_price:.2f} €',
                f'{item.total:.2f} €'
            ])
        
        items_table = Table(items_data, colWidths=[8*cm, 2*cm, 2*cm, 2*cm])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 0.5*cm))
        
        # Total
        total_data = [
            ['', '', 'TOTAL:', f'{invoice.total:.2f} €']
        ]
        total_table = Table(total_data, colWidths=[8*cm, 2*cm, 2*cm, 2*cm])
        total_table.setStyle(TableStyle([
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (2, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (2, 0), (-1, -1), 14),
            ('TEXTCOLOR', (2, 0), (-1, -1), colors.HexColor('#667eea')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
        ]))
        elements.append(total_table)
        
        # Notas
        if invoice.notes:
            elements.append(Spacer(1, 1*cm))
            elements.append(Paragraph('<b>Notas:</b>', styles['Heading3']))
            elements.append(Paragraph(invoice.notes, styles['Normal']))
        
        # Construir PDF
        doc.build(elements)
        buffer.seek(0)
        
        # Preparar respuesta
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="factura_{invoice.id:04d}.pdf"'
        return response


class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Budget.objects.select_related('patient__user', 'professional__user')
        
        if user.role == user.Roles.PATIENT:
            patient_profile = getattr(user, 'patient_profile', None)
            if patient_profile:
                return queryset.filter(patient=patient_profile)
            return queryset.none()
        
        # Profesionales y admins ven todos los presupuestos
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        
        return queryset

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsProfessionalOrAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        user = self.request.user
        professional_profile = getattr(user, 'professional_profile', None)
        if professional_profile:
            serializer.save(professional=professional_profile)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Aprobar un presupuesto"""
        budget = self.get_object()
        if request.user.role == request.user.Roles.PATIENT:
            budget.status = 'APPROVED'
            budget.save(update_fields=['status'])
            return Response({'status': 'approved'}, status=status.HTTP_200_OK)
        return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Rechazar un presupuesto"""
        budget = self.get_object()
        if request.user.role == request.user.Roles.PATIENT:
            budget.status = 'REJECTED'
            budget.save(update_fields=['status'])
            return Response({'status': 'rejected'}, status=status.HTTP_200_OK)
        return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
