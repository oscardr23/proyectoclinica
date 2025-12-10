"""Vistas para informes y reportes del sistema"""
from datetime import datetime, timedelta

from django.db.models import Sum, Count, Q, Avg
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from appointments.models import Appointment
from billing.models import Invoice, Service
from patients.models import PatientProfile
from staff.models import ProfessionalProfile


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    """Estadísticas generales para el dashboard"""
    user = request.user
    
    # Solo admins y profesionales ven estadísticas globales
    if user.role not in [user.Roles.ADMIN, user.Roles.PROFESSIONAL]:
        return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
    
    today = timezone.now().date()
    month_start = today.replace(day=1)
    month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    
    # Citas del mes
    appointments_month = Appointment.objects.filter(
        start_time__date__gte=month_start,
        start_time__date__lte=month_end,
    )
    
    # Estadísticas de citas
    total_appointments = appointments_month.count()
    confirmed_appointments = appointments_month.filter(status=Appointment.Status.CONFIRMED).count()
    completed_appointments = appointments_month.filter(status=Appointment.Status.COMPLETED).count()
    cancelled_appointments = appointments_month.filter(status=Appointment.Status.CANCELLED).count()
    
    # Próximas citas (próximos 7 días)
    next_week = today + timedelta(days=7)
    upcoming_appointments = Appointment.objects.filter(
        start_time__date__gte=today,
        start_time__date__lte=next_week,
        status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
    ).count()
    
    # Pacientes activos (con citas en el último mes)
    active_patients = PatientProfile.objects.filter(
        appointments__start_time__date__gte=month_start,
        appointments__start_time__date__lte=month_end,
    ).distinct().count()
    
    # Facturación del mes
    invoices_month = Invoice.objects.filter(
        issued_at__gte=month_start,
        issued_at__lte=month_end,
    )
    
    total_billing = invoices_month.aggregate(total=Sum('total'))['total'] or 0
    paid_billing = invoices_month.filter(status=Invoice.Status.PAID).aggregate(total=Sum('total'))['total'] or 0
    pending_billing = invoices_month.filter(
        status=Invoice.Status.SENT,
        due_date__gte=today
    ).aggregate(total=Sum('total'))['total'] or 0
    overdue_billing = invoices_month.filter(
        status=Invoice.Status.SENT,
        due_date__lt=today
    ).aggregate(total=Sum('total'))['total'] or 0
    
    return Response({
        'appointments': {
            'total_month': total_appointments,
            'confirmed': confirmed_appointments,
            'completed': completed_appointments,
            'cancelled': cancelled_appointments,
            'upcoming_week': upcoming_appointments,
        },
        'patients': {
            'active_month': active_patients,
            'total': PatientProfile.objects.count(),
        },
        'billing': {
            'total_month': float(total_billing),
            'paid_month': float(paid_billing),
            'pending_month': float(pending_billing),
            'overdue_month': float(overdue_billing),
        },
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def billing_report(request):
    """Informe de facturación"""
    user = request.user
    if user.role not in [user.Roles.ADMIN, user.Roles.PROFESSIONAL]:
        return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
    
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')
    
    if not date_from:
        date_from = (timezone.now() - timedelta(days=30)).date()
    else:
        date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
    
    if not date_to:
        date_to = timezone.now().date()
    else:
        date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
    
    invoices = Invoice.objects.filter(
        issued_at__gte=date_from,
        issued_at__lte=date_to,
    )
    
    total = invoices.aggregate(total=Sum('total'))['total'] or 0
    paid = invoices.filter(status=Invoice.Status.PAID).aggregate(total=Sum('total'))['total'] or 0
    pending = invoices.filter(
        status=Invoice.Status.SENT,
        due_date__gte=timezone.now().date()
    ).aggregate(total=Sum('total'))['total'] or 0
    overdue = invoices.filter(
        status=Invoice.Status.SENT,
        due_date__lt=timezone.now().date()
    ).aggregate(total=Sum('total'))['total'] or 0
    cancelled = invoices.filter(status=Invoice.Status.CANCELLED).aggregate(total=Sum('total'))['total'] or 0
    
    # Facturas por estado
    by_status = invoices.values('status').annotate(
        count=Count('id'),
        total=Sum('total'),
    )
    
    return Response({
        'period': {
            'from': date_from.isoformat(),
            'to': date_to.isoformat(),
        },
        'summary': {
            'total': float(total),
            'paid': float(paid),
            'pending': float(pending),
            'overdue': float(overdue),
            'cancelled': float(cancelled),
        },
        'by_status': list(by_status),
        'total_invoices': invoices.count(),
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def activity_report(request):
    """Informe de actividad de la clínica"""
    user = request.user
    if user.role not in [user.Roles.ADMIN, user.Roles.PROFESSIONAL]:
        return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
    
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')
    
    if not date_from:
        date_from = (timezone.now() - timedelta(days=30)).date()
    else:
        date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
    
    if not date_to:
        date_to = timezone.now().date()
    else:
        date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
    
    appointments = Appointment.objects.filter(
        start_time__date__gte=date_from,
        start_time__date__lte=date_to,
    )
    
    # Citas por estado
    by_status = appointments.values('status').annotate(count=Count('id'))
    
    # Citas por profesional
    by_professional = appointments.values(
        'professional__user__first_name',
        'professional__user__last_name',
    ).annotate(count=Count('id'))
    
    # Citas por día
    by_day = appointments.extra(
        select={'day': 'DATE(start_time)'}
    ).values('day').annotate(count=Count('id')).order_by('day')
    
    return Response({
        'period': {
            'from': date_from.isoformat(),
            'to': date_to.isoformat(),
        },
        'total_appointments': appointments.count(),
        'by_status': list(by_status),
        'by_professional': list(by_professional),
        'by_day': list(by_day),
    })

