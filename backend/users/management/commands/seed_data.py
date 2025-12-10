"""
Management command para poblar la base de datos con datos de ejemplo
Uso: python manage.py seed_data
"""
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from appointments.models import Appointment, Notification
from billing.models import Budget, Invoice, InvoiceItem, Service
from patients.models import ClinicalRecord, Document, PatientProfile
from resources.models import Equipment, Room
from staff.models import ProfessionalProfile

User = get_user_model()


def calculate_dni_letter(numbers):
    """Calcula la letra correcta para un DNI español"""
    valid_letters = 'TRWAGMYFPDXBNJZSQVHLCKE'
    return valid_letters[int(numbers) % 23]


class Command(BaseCommand):
    help = 'Pobla la base de datos con datos de ejemplo'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Iniciando población de datos...'))

        # Limpiar datos existentes (mantener usuarios pero limpiar pacientes, citas, recursos y facturación)
        self.stdout.write('Limpiando datos existentes...')
        InvoiceItem.objects.all().delete()
        Invoice.objects.all().delete()
        Budget.objects.all().delete()
        ClinicalRecord.objects.all().delete()
        Document.objects.all().delete()
        Appointment.objects.all().delete()
        Notification.objects.all().delete()
        PatientProfile.objects.all().delete()
        # Eliminar usuarios pacientes pero mantener profesionales y superusuarios
        User.objects.filter(role=User.Roles.PATIENT).delete()
        Service.objects.all().delete()
        Equipment.objects.all().delete()
        Room.objects.all().delete()

        # Crear usuarios y profesionales
        self.stdout.write('Creando profesionales...')
        prof1 = self.create_professional(
            'dr.garcia@dentconnect.com',
            'Dr. García',
            'García López',
            'Odontología General',
            '12345',
        )
        prof2 = self.create_professional(
            'dra.martinez@dentconnect.com',
            'Dra. Martínez',
            'Martínez Ruiz',
            'Ortodoncia',
            '12346',
        )
        prof3 = self.create_professional(
            'dr.rodriguez@dentconnect.com',
            'Dr. Rodríguez',
            'Rodríguez Sánchez',
            'Implantología',
            '12347',
        )

        # Crear pacientes
        self.stdout.write('Creando pacientes...')
        patients = []
        # Datos con DNIs válidos (con letra correcta) y fechas de nacimiento correctas
        dni_numbers = [
            '12345678', '23456789', '34567890', '45678901', '56789012',
            '67890123', '78901234', '89012345', '90123456', '01234567',
            '12345679', '23456780', '34567891', '45678902', '56789013',
        ]
        
        patient_data = [
            ('maria.lopez@email.com', 'María', 'López García', '612345678', date(1990, 5, 15), 'Penicilina'),
            ('juan.perez@email.com', 'Juan', 'Pérez Martínez', '623456789', date(1985, 8, 20), ''),
            ('ana.garcia@email.com', 'Ana', 'García Fernández', '634567890', date(1992, 3, 10), 'Látex'),
            ('carlos.ruiz@email.com', 'Carlos', 'Ruiz Torres', '645678901', date(1988, 11, 25), ''),
            ('laura.sanchez@email.com', 'Laura', 'Sánchez Díaz', '656789012', date(1995, 7, 5), 'Anestesia local'),
            ('pedro.martin@email.com', 'Pedro', 'Martín Gómez', '667890123', date(1987, 9, 12), ''),
            ('sofia.jimenez@email.com', 'Sofía', 'Jiménez Moreno', '678901234', date(1993, 2, 28), ''),
            ('david.fernandez@email.com', 'David', 'Fernández Castro', '689012345', date(1991, 6, 18), ''),
            ('carmen.torres@email.com', 'Carmen', 'Torres Vázquez', '690123456', date(1994, 4, 22), ''),
            ('miguel.ramos@email.com', 'Miguel', 'Ramos Iglesias', '601234567', date(1989, 12, 3), 'Ibuprofeno'),
            ('elena.morales@email.com', 'Elena', 'Morales Delgado', '612345679', date(1996, 8, 14), ''),
            ('javier.ortega@email.com', 'Javier', 'Ortega Campos', '623456780', date(1986, 1, 30), ''),
        ]

        for i, (email, first_name, last_name, phone, dob, allergies) in enumerate(patient_data):
            dni_number = dni_numbers[i % len(dni_numbers)]
            dni_letter = calculate_dni_letter(dni_number)
            doc_id = f'{dni_number}{dni_letter}'
            patient = self.create_patient(email, first_name, last_name, phone, doc_id, dob, allergies)
            patients.append(patient)

        # Crear salas
        self.stdout.write('Creando salas...')
        room1 = Room.objects.create(
            name='Sala 1 - Odontología General',
            description='Sala equipada para tratamientos generales',
            is_active=True,
        )
        room2 = Room.objects.create(
            name='Sala 2 - Ortodoncia',
            description='Sala especializada en ortodoncia',
            is_active=True,
        )
        room3 = Room.objects.create(
            name='Sala 3 - Implantología',
            description='Sala para cirugías e implantes',
            is_active=True,
        )

        # Crear equipos
        self.stdout.write('Creando equipos...')
        today = date.today()
        equipment_data = [
            # name, room, status, last_maintenance (para calcular próxima revisión en frontend)
            ('Radiografía Digital', room1, 'AVAILABLE', today - timedelta(days=20)),
            ('Lámpara LED', room1, 'AVAILABLE', today - timedelta(days=40)),
            ('Unidad de Aspiración', room1, 'AVAILABLE', today - timedelta(days=10)),
            ('Radiografía Panorámica', room2, 'AVAILABLE', today - timedelta(days=60)),
            ('Escáner 3D', room3, 'AVAILABLE', today - timedelta(days=15)),
            ('Lámpara Quirúrgica', room3, 'AVAILABLE', today - timedelta(days=75)),
        ]

        equipment_list = []
        for name, room, status, last_maint in equipment_data:
            eq = Equipment.objects.create(
                name=name,
                room=room,
                status=status,
                description=f'Equipo {name} en {room.name}',
                last_maintenance=last_maint,
                is_active=True,
            )
            equipment_list.append(eq)

        # Crear servicios
        self.stdout.write('Creando servicios...')
        services = []
        service_data = [
            ('Limpieza Dental', Decimal('45.00'), 'Limpieza profesional y eliminación de sarro'),
            ('Empaste', Decimal('80.00'), 'Obturación de caries'),
            ('Endodoncia', Decimal('250.00'), 'Tratamiento de conductos'),
            ('Ortodoncia Inicial', Decimal('150.00'), 'Consulta y diagnóstico ortodóncico'),
            ('Brackets Metálicos', Decimal('2000.00'), 'Instalación de brackets metálicos'),
            ('Implante Dental', Decimal('1200.00'), 'Implante y corona'),
            ('Radiografía', Decimal('25.00'), 'Radiografía intraoral'),
            ('Blanqueamiento', Decimal('300.00'), 'Tratamiento de blanqueamiento dental'),
            ('Extracción Simple', Decimal('60.00'), 'Extracción de diente sin complicaciones'),
            ('Corona Cerámica', Decimal('450.00'), 'Corona de porcelana'),
            ('Prótesis Removible', Decimal('350.00'), 'Prótesis dental removible'),
            ('Consulta General', Decimal('40.00'), 'Consulta odontológica general'),
        ]

        for name, price, desc in service_data:
            service = Service.objects.create(
                name=name,
                base_price=price,
                description=desc,
                is_active=True,
            )
            services.append(service)
        
        # Crear citas
        self.stdout.write('Creando citas...')
        now = timezone.now()
        appointments = []
        
        # Citas pasadas (completadas)
        for i in range(8):
            start = now - timedelta(days=i+2, hours=10-i)
            apt = Appointment.objects.create(
                patient=patients[i % len(patients)],
                professional=prof1 if i % 3 == 0 else (prof2 if i % 3 == 1 else prof3),
                room=room1 if i % 3 == 0 else (room2 if i % 3 == 1 else room3),
                start_time=start,
                end_time=start + timedelta(hours=1),
                status=Appointment.Status.COMPLETED,
                treatment_type=services[i % len(services)].name,
                notes=f'Consulta realizada correctamente. El paciente respondió bien al tratamiento.',
                created_by=prof1.user,
            )
            if equipment_list:
                apt.equipment.set([equipment_list[i % len(equipment_list)]])
            appointments.append(apt)

        # Citas futuras (pendientes y confirmadas)
        for i in range(15):
            start = now + timedelta(days=i+1, hours=9 + (i % 8))
            status = Appointment.Status.CONFIRMED if i % 3 != 0 else Appointment.Status.PENDING
            apt = Appointment.objects.create(
                patient=patients[i % len(patients)],
                professional=prof1 if i % 3 == 0 else (prof2 if i % 3 == 1 else prof3),
                room=room1 if i % 3 == 0 else (room2 if i % 3 == 1 else room3),
                start_time=start,
                end_time=start + timedelta(hours=1),
                status=status,
                treatment_type=services[i % len(services)].name,
                notes=f'Cita programada para {services[i % len(services)].name}',
                created_by=prof1.user,
            )
            if equipment_list and i % 2 == 0:
                apt.equipment.set([equipment_list[i % len(equipment_list)]])
            appointments.append(apt)

        # Crear historial clínico
        self.stdout.write('Creando historial clínico...')
        for i, patient in enumerate(patients[:8]):
            for j in range(2):
                appointment = None
                if i*2 + j < len(appointments):
                    appointment = appointments[i*2 + j]
                ClinicalRecord.objects.create(
                    patient=patient,
                    appointment=appointment,
                    professional=prof1 if j % 2 == 0 else prof2,
                    treatment=services[(i+j) % len(services)].name,
                    notes=f'Tratamiento realizado con éxito. El paciente respondió bien al tratamiento.',
                    diagnosis=f'Diagnóstico: {services[(i+j) % len(services)].name}',
                )

        # Crear presupuestos
        self.stdout.write('Creando presupuestos...')
        for i, patient in enumerate(patients[:10]):
            Budget.objects.create(
                patient=patient,
                professional=prof1 if i % 3 == 0 else (prof2 if i % 3 == 1 else prof3),
                description=f'Presupuesto para {services[i % len(services)].name}',
                estimated_cost=services[i % len(services)].base_price * Decimal('1.2'),
                status='APPROVED' if i % 3 == 0 else ('PENDING' if i % 3 == 1 else 'DRAFT'),
            )

        # Crear facturas
        self.stdout.write('Creando facturas...')
        invoice_statuses = [
            Invoice.Status.DRAFT,
            Invoice.Status.DRAFT,
            Invoice.Status.DRAFT,
            Invoice.Status.DRAFT,
            Invoice.Status.SENT,
            Invoice.Status.SENT,
            Invoice.Status.PAID,
            Invoice.Status.PAID,
            Invoice.Status.DRAFT,
            Invoice.Status.DRAFT,
            Invoice.Status.SENT,
            Invoice.Status.PAID,
        ]
        
        # Crear facturas para todos los pacientes disponibles
        num_patients = len(patients)
        for i, patient in enumerate(patients):
            # Asegurar que due_date no sea en el pasado ni más de un año en el futuro
            issued_date = date.today() - timedelta(days=i*3)
            due_date = issued_date + timedelta(days=30)
            
            # Validar que due_date no sea más de un año en el futuro
            max_date = date.today() + timedelta(days=365)
            if due_date > max_date:
                due_date = max_date
            
            invoice = Invoice.objects.create(
                patient=patient,
                issued_by=prof1.user,
                status=invoice_statuses[i % len(invoice_statuses)],
                issued_at=issued_date,
                due_date=due_date if invoice_statuses[i % len(invoice_statuses)] != Invoice.Status.DRAFT else None,
                notes=f'Factura por servicios prestados',
            )
            
            # Añadir items a la factura
            num_items = (i % 3) + 1
            total = Decimal('0')
            for j in range(num_items):
                service = services[(i+j) % len(services)]
                quantity = (j % 2) + 1
                InvoiceItem.objects.create(
                    invoice=invoice,
                    service=service,
                    quantity=quantity,
                    unit_price=service.base_price,
                )
                total += service.base_price * quantity
            
            invoice.total = total
            invoice.save()

        # Mostrar resumen de facturas creadas
        draft_count = Invoice.objects.filter(status=Invoice.Status.DRAFT).count()
        sent_count = Invoice.objects.filter(status=Invoice.Status.SENT).count()
        paid_count = Invoice.objects.filter(status=Invoice.Status.PAID).count()
        self.stdout.write(self.style.SUCCESS(f'  - Facturas creadas: {Invoice.objects.count()} total'))
        self.stdout.write(f'    • {draft_count} en borrador (DRAFT)')
        self.stdout.write(f'    • {sent_count} enviadas (SENT)')
        self.stdout.write(f'    • {paid_count} pagadas (PAID)')

        # Crear notificaciones
        self.stdout.write('Creando notificaciones...')
        confirmed_appointments = [apt for apt in appointments if apt.status == Appointment.Status.CONFIRMED]
        for i, apt in enumerate(confirmed_appointments[:6]):
            Notification.objects.create(
                appointment=apt,
                patient=apt.patient,
                notification_type=Notification.NotificationType.APPOINTMENT_CONFIRMED,
                channel=Notification.Channel.IN_APP,
                title='Cita confirmada',
                message=f'Su cita para {apt.treatment_type} el {apt.start_time.strftime("%d/%m/%Y %H:%M")} ha sido confirmada.',
                sent_at=timezone.now() - timedelta(hours=2),
            )
        
        # Crear algunas notificaciones de recordatorio
        for apt in confirmed_appointments[:3]:
            Notification.objects.create(
                appointment=apt,
                patient=apt.patient,
                notification_type=Notification.NotificationType.APPOINTMENT_REMINDER,
                channel=Notification.Channel.IN_APP,
                title='Recordatorio de cita',
                message=f'Recordatorio: Tiene una cita programada para {apt.treatment_type} el {apt.start_time.strftime("%d/%m/%Y %H:%M")}.',
                sent_at=timezone.now() - timedelta(days=1),
            )

        self.stdout.write(self.style.SUCCESS(f'✓ Datos creados exitosamente:'))
        self.stdout.write(f'  - {User.objects.count()} usuarios')
        self.stdout.write(f'  - {ProfessionalProfile.objects.count()} profesionales')
        self.stdout.write(f'  - {PatientProfile.objects.count()} pacientes')
        self.stdout.write(f'  - {Room.objects.count()} salas')
        self.stdout.write(f'  - {Equipment.objects.count()} equipos')
        self.stdout.write(f'  - {Service.objects.count()} servicios')
        self.stdout.write(f'  - {Appointment.objects.count()} citas')
        self.stdout.write(f'  - {ClinicalRecord.objects.count()} registros clínicos')
        self.stdout.write(f'  - {Budget.objects.count()} presupuestos')
        self.stdout.write(f'  - {Invoice.objects.count()} facturas')
        self.stdout.write(f'  - {Notification.objects.count()} notificaciones')

    def create_professional(self, email, first_name, last_name, specialty, license_number):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'first_name': first_name,
                'last_name': last_name,
                'role': User.Roles.PROFESSIONAL,
                'is_active': True,
            },
        )
        if not created:
            user.first_name = first_name
            user.last_name = last_name
            user.role = User.Roles.PROFESSIONAL
            user.save()

        # Establecer contraseña por defecto
        user.set_password('1234')
        user.save()

        profile, _ = ProfessionalProfile.objects.get_or_create(
            user=user,
            defaults={
                'specialty': specialty,
                'license_number': license_number,
                'bio': f'Profesional especializado en {specialty}',
                'working_days': 'LUN-VIE',
                'start_hour': datetime.strptime('09:00', '%H:%M').time(),
                'end_hour': datetime.strptime('18:00', '%H:%M').time(),
            },
        )
        return profile

    def create_patient(self, email, first_name, last_name, phone, doc_id, date_of_birth, allergies):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'first_name': first_name,
                'last_name': last_name,
                'phone': phone,
                'document_id': doc_id,
                'role': User.Roles.PATIENT,
                'is_active': True,
            },
        )
        if not created:
            user.first_name = first_name
            user.last_name = last_name
            user.phone = phone
            user.document_id = doc_id
            user.role = User.Roles.PATIENT
            user.save()

        # Establecer contraseña por defecto
        user.set_password('1234')
        user.save()

        profile, _ = PatientProfile.objects.get_or_create(
            user=user,
            defaults={
                'date_of_birth': date_of_birth,
                'allergies': allergies,
                'medical_notes': f'Paciente desde {date.today().year}',
            },
        )
        return profile

