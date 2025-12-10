import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { Appointment, Invoice, PatientProfile } from '../../core/models';

@Component({
  selector: 'dc-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <h3>{{ monthlyAppointments.length }}</h3>
        <p style="color: white;">Citas este Mes</p>
      </div>
      <div class="stat-card">
        <h3>{{ completedAppointments }}</h3>
        <p style="color: white;">Citas Completadas</p>
      </div>
      <div class="stat-card">
        <h3>{{ cancelledAppointments }}</h3>
        <p style="color: white;">Citas Canceladas</p>
      </div>
      <div class="stat-card">
        <h3>{{ attendanceRate }}%</h3>
        <p style="color: white;">Ratio de Asistencia</p>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Próximas Citas</h2>
      </div>
      <div class="search-bar">
        <input type="text" placeholder="Buscar por paciente, profesional, tratamiento, sala o fecha..." [(ngModel)]="searchTerm" />
      </div>
      <div *ngIf="filteredUpcomingAppointments.length === 0" class="empty-state">
        <p>{{ searchTerm ? 'No se encontraron citas con ese criterio' : 'No hay citas próximas' }}</p>
      </div>
      <div class="appointments-grid">
        <div *ngFor="let appointment of filteredUpcomingAppointments" class="appointment-item">
          <div class="appointment-info">
            <div class="appointment-date">
              <strong>{{ formatDate(appointment.start_time) }}</strong>
            </div>
            <div class="appointment-time">
              {{ formatTime(appointment.start_time) }} - {{ formatTime(appointment.end_time) }}
            </div>
            <div class="appointment-patient">
              <strong>{{ appointment.patient?.user?.first_name }} {{ appointment.patient?.user?.last_name }}</strong> - {{ appointment.treatment_type || 'Sin tratamiento' }}
            </div>
            <div style="margin-top: 0.3rem; color: #666; font-size: 0.9rem;">
              {{ appointment.room?.name || 'Sin sala' }} - {{ appointment.professional?.user?.first_name }} {{ appointment.professional?.user?.last_name || 'Sin profesional' }}
            </div>
          </div>
          <span class="appointment-status" [ngClass]="'status-' + appointment.status.toLowerCase()">
            {{ getStatusLabel(appointment.status) }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
      }

      .stat-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      }

      .stat-card h3 {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
      }

      .stat-card p {
        opacity: 0.9;
        font-size: 0.9rem;
      }

      .section {
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        padding: 2rem;
        margin-bottom: 2rem;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #f0f0f0;
      }

      .section-header h2 {
        color: #667eea;
        font-size: 1.5rem;
      }

      .search-bar {
        margin-bottom: 1.5rem;
      }

      .search-bar input {
        width: 100%;
        padding: 0.8rem;
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        font-size: 1rem;
        transition: border-color 0.3s;
      }

      .search-bar input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .appointments-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }

      .appointment-item {
        display: flex;
        flex-direction: column;
        padding: 1rem;
        border-left: 4px solid #667eea;
        background-color: #fafafa;
        border-radius: 5px;
        transition: all 0.3s;
      }

      .appointment-item:hover {
        background-color: #f0f4ff;
        transform: translateX(5px);
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
      }

      .appointment-info {
        flex: 1;
        margin-bottom: 0.5rem;
      }

      .appointment-date {
        font-weight: 600;
        color: #667eea;
        font-size: 1rem;
        margin-bottom: 0.3rem;
        text-transform: capitalize;
      }

      .appointment-time {
        font-weight: 600;
        color: #667eea;
        font-size: 1.1rem;
        margin-bottom: 0.3rem;
      }

      .appointment-patient {
        color: #333;
        margin-top: 0.3rem;
        font-size: 0.95rem;
      }

      .appointment-status {
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 500;
        align-self: flex-start;
        margin-top: 0.5rem;
      }

      .status-confirmed {
        background-color: #4CAF50;
        color: white;
      }

      .status-pending {
        background-color: #ff9800;
        color: white;
      }

      .status-cancelled {
        background-color: #f44336;
        color: white;
      }

      .empty-state {
        text-align: center;
        padding: 2rem;
        color: #999;
        grid-column: 1 / -1;
      }

      @media (max-width: 768px) {
        .appointments-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);

  appointments: Appointment[] = [];
  patients: PatientProfile[] = [];
  invoices: Invoice[] = [];
  searchTerm = '';

  ngOnInit() {
    forkJoin({
      appointments: this.api.getAppointments(),
      patients: this.api.getPatients(),
      invoices: this.api.getInvoices(),
    }).subscribe(({ appointments, patients, invoices }) => {
      this.appointments = appointments;
      this.patients = patients;
      this.invoices = invoices;
    });
  }

  get completedAppointments(): number {
    return this.appointments.filter(a => a.status === 'COMPLETED').length;
  }
  
  get monthlyAppointments(): Appointment[] {
    const now = new Date();
    return this.appointments.filter(a => {
      const aptDate = new Date(a.start_time);
      return aptDate.getMonth() === now.getMonth() && 
             aptDate.getFullYear() === now.getFullYear();
    });
  }

  get cancelledAppointments(): number {
    return this.appointments.filter(a => a.status === 'CANCELLED').length;
  }

  get attendanceRate(): number {
    const now = new Date();
    const monthly = this.monthlyAppointments;
    
    // Solo considerar citas pasadas (ya se realizaron) para el ratio de asistencia
    const pastAppointments = monthly.filter(a => {
      const aptDate = new Date(a.start_time);
      return aptDate < now;
    });
    
    if (pastAppointments.length === 0) return 0;
    
    // Citas asistidas = completadas + citas pasadas que no fueron canceladas
    // (si una cita ya pasó y no está cancelada, se asume que se asistió)
    const attended = pastAppointments.filter(a => a.status !== 'CANCELLED').length;
    const total = pastAppointments.length;
    
    if (total === 0) return 0;
    return Math.round((attended / total) * 100);
  }

  get upcomingAppointments(): Appointment[] {
    const now = new Date();
    return this.appointments
      .filter(a => new Date(a.start_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 10);
  }

  get filteredUpcomingAppointments(): Appointment[] {
    const appointments = this.upcomingAppointments;
    if (!this.searchTerm) {
      return appointments;
    }
    
    const term = this.searchTerm.toLowerCase().trim();
    return appointments.filter(appointment => {
      const patientName = `${appointment.patient?.user?.first_name || ''} ${appointment.patient?.user?.last_name || ''}`.toLowerCase();
      const professionalName = `${appointment.professional?.user?.first_name || ''} ${appointment.professional?.user?.last_name || ''}`.toLowerCase();
      const treatmentType = (appointment.treatment_type || '').toLowerCase();
      const roomName = (appointment.room?.name || '').toLowerCase();
      
      // Búsqueda por fecha formateada (Hoy, Mañana, día de la semana, fecha completa)
      const formattedDate = this.formatDate(appointment.start_time).toLowerCase();
      
      // Búsqueda por fecha en formato numérico (DD/MM, DD/MM/YYYY, etc.)
      const appointmentDate = new Date(appointment.start_time);
      const day = appointmentDate.getDate().toString();
      const month = (appointmentDate.getMonth() + 1).toString();
      const year = appointmentDate.getFullYear().toString();
      const dateDDMM = `${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
      const dateDDMMYYYY = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      const dateYYYYMMDD = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      // Búsqueda por nombre del día de la semana en español
      const dayNames = ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo'];
      const dayName = appointmentDate.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
      
      return patientName.includes(term) ||
             professionalName.includes(term) ||
             treatmentType.includes(term) ||
             roomName.includes(term) ||
             formattedDate.includes(term) ||
             dateDDMM.includes(term) ||
             dateDDMMYYYY.includes(term) ||
             dateYYYYMMDD.includes(term) ||
             dayName.includes(term) ||
             dayNames.some(dn => dn.includes(term) && dayName.includes(dn));
    });
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Si es hoy
    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    }
    // Si es mañana
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Mañana';
    }
    // Si es esta semana, mostrar día de la semana
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    if (date < weekFromNow) {
      return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    // Para fechas más lejanas, mostrar fecha completa
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'CONFIRMED': 'Confirmada',
      'PENDING': 'Pendiente',
      'CANCELLED': 'Cancelada',
      'COMPLETED': 'Completada',
      'URGENT': 'Urgente',
    };
    return labels[status] || status;
  }
}
