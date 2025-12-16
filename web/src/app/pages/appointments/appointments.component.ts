import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';

import {
  Appointment,
  PatientProfile,
  ProfessionalProfile,
  Room,
  Service,
} from '../../core/models';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'dc-appointments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="tabs-container" *ngIf="isPatient()">
      <div class="tabs">
        <button class="tab" [class.active]="activeTab === 'my-appointments'" (click)="switchToTab('my-appointments')">Mis Citas</button>
        <button class="tab" [class.active]="activeTab === 'available'" (click)="switchToTab('available')">Horarios Disponibles</button>
        <button class="tab" [class.active]="activeTab === 'request'" (click)="switchToTab('request')">Solicitar Cita</button>
      </div>
    </div>

    <!-- Calendario de Horarios Disponibles (solo pacientes) -->
    <div *ngIf="isPatient() && activeTab === 'available'" class="calendar-section">
      <div class="calendar-header">
        <h2>Horarios Disponibles</h2>
        <div class="calendar-controls">
          <div class="date-selector">
            <button class="btn btn-secondary" (click)="previousMonth()">‹</button>
            <span style="padding: 0.6rem 1.2rem; font-weight: 600;">{{ currentMonth }}</span>
            <button class="btn btn-secondary" (click)="nextMonth()">›</button>
          </div>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <select [(ngModel)]="selectedProfessionalForAvailability" (change)="loadAvailabilityForCalendar()" style="padding: 0.6rem 1rem; border: 2px solid #e0e0e0; border-radius: 5px;">
              <option *ngFor="let pro of professionals" [value]="pro.id">
                {{ pro.user.first_name }} {{ pro.user.last_name }} - {{ pro.specialty }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div class="calendar-grid">
        <div class="calendar-day-header" *ngFor="let day of weekDays">{{ day }}</div>
        <div
          *ngFor="let day of calendarDays"
          class="calendar-day"
          [class.today]="isToday(day)"
        >
          <div class="day-number">{{ day.getDate() }}</div>
          <div
            *ngFor="let slot of getAvailableSlotsForDay(day)"
            class="appointment available-slot"
            (click)="selectAvailableSlot(slot, day)"
          >
            {{ formatTime(slot.start) }} - Disponible
          </div>
        </div>
      </div>
    </div>

    <!-- Calendario Mis Citas (solo pacientes) -->
    <div *ngIf="isPatient() && activeTab === 'my-appointments'" class="calendar-section">
      <div class="calendar-header">
        <h2>Mis Citas</h2>
        <div class="calendar-controls">
          <div class="date-selector">
            <button class="btn btn-secondary" (click)="previousMonth()">‹</button>
            <span style="padding: 0.6rem 1.2rem; font-weight: 600;">{{ currentMonth }}</span>
            <button class="btn btn-secondary" (click)="nextMonth()">›</button>
          </div>
        </div>
      </div>

      <div class="calendar-grid">
        <div class="calendar-day-header" *ngFor="let day of weekDays">{{ day }}</div>
        <div
          *ngFor="let day of calendarDays"
          class="calendar-day"
          [class.today]="isToday(day)"
        >
          <div class="day-number">{{ day.getDate() }}</div>
          <div
            *ngFor="let apt of getAppointmentsForDay(day); trackBy: trackByAppointmentId"
            class="appointment"
            [class.urgent]="apt.status === 'URGENT'"
            [class.pending]="apt.status === 'PENDING'"
            [class.confirmed]="apt.status === 'CONFIRMED'"
            (click)="selectAppointment(apt)"
          >
            {{ formatTime(apt.start_time) }} - {{ apt.professional?.user?.first_name || 'Sin asignar' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Calendario de Citas (administradores y profesionales) -->
    <div *ngIf="!isPatient()" class="calendar-section">
      <div class="calendar-header">
        <h2>Calendario de Citas</h2>
        <div class="calendar-controls">
          <div class="date-selector">
            <button class="btn btn-secondary" (click)="previousMonth()">‹</button>
            <span style="padding: 0.6rem 1.2rem; font-weight: 600;">{{ currentMonth }}</span>
            <button class="btn btn-secondary" (click)="nextMonth()">›</button>
          </div>
          <button *ngIf="!isPatient()" class="btn btn-primary" (click)="showNewAppointmentForm = !showNewAppointmentForm">Nueva Cita</button>
        </div>
      </div>

      <div *ngIf="showNewAppointmentForm" class="appointment-form-card">
        <form [formGroup]="form" (ngSubmit)="createAppointment()">
          <div class="form-grid">
            <div class="form-group">
              <label>Paciente *</label>
              <select formControlName="patient_id">
                <option value="">Selecciona paciente</option>
                <option *ngFor="let patient of patients" [value]="patient.id">
                  {{ patient.user.first_name }} {{ patient.user.last_name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Profesional *</label>
              <select formControlName="professional_id">
                <option value="">Selecciona profesional</option>
                <option *ngFor="let pro of professionals" [value]="pro.id">
                  {{ pro.user.first_name }} {{ pro.user.last_name }} - {{ pro.specialty }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Sala *</label>
              <select formControlName="room_id">
                <option value="">Selecciona sala</option>
                <option *ngFor="let room of rooms" [value]="room.id">
                  {{ room.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Fecha y Hora de Inicio *</label>
              <input type="datetime-local" formControlName="start_time" [min]="getMinDateTime()" [max]="getMaxDateTime()" (change)="onStartTimeChange()" />
              <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem;">La cita durará 1 hora</small>
              <small *ngIf="form.get('start_time')?.touched && getStartTimeErrorMessage()" style="color: #f44336; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                {{ getStartTimeErrorMessage() }}
              </small>
            </div>
            <div class="form-group">
              <label>Tipo de Tratamiento *</label>
              <div class="equipment-dropdown-container">
                <div class="equipment-dropdown" (click)="toggleTreatmentTypeDropdownForForm()">
                  <span *ngIf="!form.value.treatment_type || form.value.treatment_type === ''" class="dropdown-placeholder">
                    Seleccione un tratamiento
                  </span>
                  <span *ngIf="form.value.treatment_type && form.value.treatment_type !== ''" class="dropdown-selected">
                    {{ form.value.treatment_type }}
                  </span>
                  <span class="dropdown-arrow">▼</span>
                </div>
                <div *ngIf="showTreatmentTypeDropdownForForm" class="equipment-dropdown-menu">
                  <div *ngFor="let service of services" 
                       class="equipment-dropdown-item" 
                       [class.selected]="form.value.treatment_type === service.name"
                       (click)="selectTreatmentTypeForForm(service.name)">
                    <span>{{ service.name }}</span>
                  </div>
                  <div *ngIf="services.length === 0" class="no-equipment">
                    <p>Cargando servicios disponibles...</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="form-group full-width">
              <label>Notas</label>
              <textarea formControlName="notes" rows="3" placeholder="Información adicional sobre la cita..."></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" (click)="showNewAppointmentForm = false">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="form.invalid">Crear Cita</button>
          </div>
        </form>
      </div>

      <div *ngIf="showEditAppointmentForm && selectedAppointment" class="appointment-form-card">
        <h3 style="margin-bottom: 1rem; color: #667eea;">Editar Cita</h3>
        <form [formGroup]="editForm" (ngSubmit)="updateAppointment()">
          <div class="form-grid">
            <div class="form-group">
              <label>Paciente *</label>
              <select formControlName="patient_id">
                <option value="">Selecciona paciente</option>
                <option *ngFor="let patient of patients" [value]="patient.id">
                  {{ patient.user.first_name }} {{ patient.user.last_name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Profesional *</label>
              <select formControlName="professional_id">
                <option value="">Selecciona profesional</option>
                <option *ngFor="let pro of professionals" [value]="pro.id">
                  {{ pro.user.first_name }} {{ pro.user.last_name }} - {{ pro.specialty }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Sala *</label>
              <select formControlName="room_id">
                <option value="">Selecciona sala</option>
                <option *ngFor="let room of rooms" [value]="room.id">
                  {{ room.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Fecha y Hora de Inicio *</label>
              <input type="datetime-local" formControlName="start_time" [min]="getMinDateTime()" [max]="getMaxDateTime()" (change)="onEditStartTimeChange()" />
              <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem;">La cita durará 1 hora</small>
              <small *ngIf="editForm.get('start_time')?.touched && getEditStartTimeErrorMessage()" style="color: #f44336; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                {{ getEditStartTimeErrorMessage() }}
              </small>
            </div>
            <div class="form-group">
              <label>Tipo de Tratamiento *</label>
              <div class="equipment-dropdown-container">
                <div class="equipment-dropdown" (click)="toggleTreatmentTypeDropdownForEdit()">
                  <span *ngIf="!editForm.value.treatment_type || editForm.value.treatment_type === ''" class="dropdown-placeholder">
                    Seleccione un tratamiento
                  </span>
                  <span *ngIf="editForm.value.treatment_type && editForm.value.treatment_type !== ''" class="dropdown-selected">
                    {{ editForm.value.treatment_type }}
                  </span>
                  <span class="dropdown-arrow">▼</span>
                </div>
                <div *ngIf="showTreatmentTypeDropdownForEdit" class="equipment-dropdown-menu">
                  <div *ngFor="let service of services" 
                       class="equipment-dropdown-item" 
                       [class.selected]="editForm.value.treatment_type === service.name"
                       (click)="selectTreatmentTypeForEdit(service.name)">
                    <span>{{ service.name }}</span>
                  </div>
                  <div *ngIf="services.length === 0" class="no-equipment">
                    <p>Cargando servicios disponibles...</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="form-group full-width">
              <label>Notas</label>
              <textarea formControlName="notes" rows="3" placeholder="Información adicional sobre la cita..."></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button *ngIf="selectedAppointment?.status === 'PENDING' && (isAdmin() || isProfessional())" type="button" class="btn btn-success" (click)="approveAppointment()" style="margin-right: 0.5rem;">Aceptar Cita</button>
            <button type="button" class="btn btn-danger" (click)="confirmDeleteAppointment()">Eliminar</button>
            <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="editForm.invalid">Guardar Cambios</button>
          </div>
        </form>
      </div>

      <div class="calendar-grid">
        <div class="calendar-day-header" *ngFor="let day of weekDays">{{ day }}</div>
        <div
          *ngFor="let day of calendarDays"
          class="calendar-day"
          [class.today]="isToday(day)"
        >
          <div class="day-number">{{ day.getDate() }}</div>
          <div
            *ngFor="let apt of getAppointmentsForDay(day); trackBy: trackByAppointmentId"
            class="appointment"
            [class.urgent]="apt.status === 'URGENT'"
            [class.pending]="apt.status === 'PENDING'"
            [class.other-professional]="isProfessional() && currentProfessionalId !== null && apt.professional?.id !== null && apt.professional?.id !== currentProfessionalId"
            (click)="selectAppointment(apt)"
          >
            {{ formatTime(apt.start_time) }} - {{ apt.professional?.user?.first_name || 'Sin asignar' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Pestaña Solicitar Cita (solo pacientes) -->
    <div *ngIf="isPatient() && activeTab === 'request'" class="section">
      <div class="section-header">
        <h2>Solicitar Nueva Cita</h2>
      </div>
      <div class="form-section">
        <form [formGroup]="requestForm" (ngSubmit)="requestAppointment()">
          <div class="form-grid">
            <div class="form-group">
              <label>Profesional *</label>
              <select formControlName="professional_id" required (change)="onProfessionalSelected()">
                <option value="">Seleccione un profesional</option>
                <option *ngFor="let pro of professionals" [value]="pro.id">
                  {{ pro.user.first_name }} {{ pro.user.last_name }} - {{ pro.specialty }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Fecha *</label>
              <input type="date" [(ngModel)]="selectedDate" [ngModelOptions]="{standalone: true}" [min]="getMinDate()" [max]="getMaxDate()" (change)="onDateSelected()" />
              <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem;">Seleccione una fecha para ver horarios disponibles</small>
            </div>
            <div class="form-group full-width">
              <label>Horarios Disponibles *</label>
              <div *ngIf="selectedDate && selectedProfessionalId && availableSlots.length > 0" class="available-slots">
                <div *ngFor="let slot of availableSlots" 
                     class="slot-item" 
                     [class.selected]="selectedSlot === slot"
                     [class.occupied]="slot.occupied"
                     (click)="selectTimeSlot(slot)">
                  <span>{{ formatTimeSlot(slot.start) }}</span>
                  <span *ngIf="slot.occupied" class="occupied-badge">Ocupado</span>
                </div>
              </div>
              <div *ngIf="!selectedDate || !selectedProfessionalId" style="padding: 1rem; background-color: #fafafa; border-radius: 5px; color: #666; text-align: center;">
                <p style="margin: 0;">Seleccione un profesional y una fecha para ver los horarios disponibles</p>
              </div>
              <div *ngIf="selectedDate && selectedProfessionalId && availableSlots.length === 0 && !loadingAvailability" style="padding: 1rem; background-color: #fff3cd; border-radius: 5px; color: #856404; text-align: center;">
                <p style="margin: 0;">No hay horarios disponibles para esta fecha</p>
              </div>
              <div *ngIf="loadingAvailability" style="padding: 1rem; background-color: #fafafa; border-radius: 5px; color: #666; text-align: center;">
                <p style="margin: 0;">Cargando horarios disponibles...</p>
              </div>
              <small *ngIf="selectedSlot && !selectedSlot.occupied" style="color: #4CAF50; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                ✓ Horario seleccionado: {{ formatTimeSlot(selectedSlot.start) }}
              </small>
            </div>
            <div class="form-group">
              <label>Tipo de Tratamiento *</label>
              <div class="equipment-dropdown-container">
                <div class="equipment-dropdown" (click)="toggleTreatmentTypeDropdown()">
                  <span *ngIf="!requestForm.value.treatment_type || requestForm.value.treatment_type === ''" class="dropdown-placeholder">
                    Seleccione un tratamiento
                  </span>
                  <span *ngIf="requestForm.value.treatment_type && requestForm.value.treatment_type !== ''" class="dropdown-selected">
                    {{ requestForm.value.treatment_type }}
                  </span>
                  <span class="dropdown-arrow">▼</span>
                </div>
                <div *ngIf="showTreatmentTypeDropdown" class="equipment-dropdown-menu">
                  <div *ngFor="let service of services" 
                       class="equipment-dropdown-item" 
                       [class.selected]="requestForm.value.treatment_type === service.name"
                       (click)="selectTreatmentType(service.name)">
                    <span>{{ service.name }}</span>
                  </div>
                  <div *ngIf="services.length === 0" class="no-equipment">
                    <p>Cargando servicios disponibles...</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="form-group full-width">
              <label>Notas o Motivo</label>
              <textarea formControlName="notes" rows="4" placeholder="Describa el motivo de la cita..."></textarea>
            </div>
          </div>
          <div style="text-align: right; margin-top: 1rem;">
            <button type="submit" class="btn btn-primary" [disabled]="requestForm.invalid || requesting">
              {{ requesting ? 'Enviando...' : 'Solicitar Cita' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal -->
    <div *ngIf="showModal" class="modal-overlay" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header" [ngClass]="'modal-' + modalType">
          <h3>{{ modalTitle }}</h3>
          <button class="modal-close" (click)="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <p style="white-space: pre-line;">{{ modalMessage }}</p>
        </div>
        <div class="modal-footer">
          <button *ngIf="modalType === 'confirm'" class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
          <button *ngIf="modalType === 'confirm'" class="btn btn-primary" (click)="confirmModal()">Confirmar</button>
          <button *ngIf="modalType !== 'confirm'" class="btn btn-primary" (click)="closeModal()">Aceptar</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .calendar-section {
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        padding: 2rem;
        margin-bottom: 2rem;
      }

      .calendar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #f0f0f0;
      }

      .calendar-header h2 {
        color: #667eea;
        font-size: 1.5rem;
      }

      .calendar-controls {
        display: flex;
        gap: 1rem;
        align-items: center;
      }

      .date-selector {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .btn {
        padding: 0.6rem 1.2rem;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.3s;
      }

      .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgba(102, 126, 234, 0.4);
      }

      .btn-success {
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        color: white;
      }

      .btn-success:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgba(76, 175, 80, 0.4);
      }

      .btn-secondary {
        background-color: #e0e0e0;
        color: #333;
      }

      .btn-secondary:hover {
        background-color: #d0d0d0;
      }

      .appointment-form-card {
        background: #fafafa;
        border-radius: 10px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .form-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }

      input,
      select {
        padding: 0.8rem;
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        font-size: 1rem;
        background-color: white;
        width: 100%;
        box-sizing: border-box;
      }

      input:focus,
      select:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .form-select {
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23667eea' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.8rem center;
        padding-right: 2.5rem;
      }

      .form-select option {
        padding: 0.5rem;
      }

      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1rem;
        margin-top: 1.5rem;
      }

      .calendar-day-header {
        text-align: center;
        font-weight: 600;
        color: #667eea;
        padding: 0.5rem;
        font-size: 0.9rem;
      }

      .calendar-day {
        min-height: 100px;
        border: 2px solid #f0f0f0;
        border-radius: 8px;
        padding: 0.5rem;
        background-color: #fafafa;
        position: relative;
        transition: all 0.3s;
      }

      .calendar-day:hover {
        border-color: #667eea;
        background-color: white;
      }

      .calendar-day.today {
        border-color: #667eea;
        background-color: #f0f4ff;
      }

      .day-number {
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: #333;
      }

      .appointment {
        background-color: #4CAF50;
        color: white;
        padding: 0.3rem 0.5rem;
        border-radius: 5px;
        font-size: 0.75rem;
        margin-bottom: 0.3rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .appointment:hover {
        transform: scale(1.05);
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      }

      .appointment.urgent {
        background-color: #f44336;
        color: white;
      }

      .appointment.pending {
        background-color: #ff9800;
        color: white;
      }

      .appointment.confirmed {
        background-color: #4CAF50;
        color: white;
      }

      .appointment.other-professional {
        background-color: #9e9e9e;
        color: white;
        opacity: 0.7;
      }

      .appointment.other-professional:hover {
        opacity: 0.9;
      }

      .appointment.available-slot {
        background-color: #e3f2fd;
        color: #1976d2;
        border: 1px solid #90caf9;
        cursor: pointer;
      }

      .appointment.available-slot:hover {
        background-color: #bbdefb;
        transform: scale(1.05);
      }

      .appointment-list {
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        padding: 2rem;
      }

      .appointment-list h3 {
        color: #667eea;
        margin-bottom: 1.5rem;
      }

      .appointment-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-left: 4px solid #667eea;
        background-color: #fafafa;
        margin-bottom: 1rem;
        border-radius: 5px;
        transition: all 0.3s;
      }

      .appointment-item:hover {
        background-color: #f0f4ff;
        transform: translateX(5px);
      }

      .appointment-info {
        flex: 1;
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
      }

      .appointment-details {
        color: #333;
        margin-top: 0.3rem;
      }

      .appointment-status {
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 500;
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
      }

      .tabs-container {
        margin-bottom: 2rem;
      }

      .tabs {
        display: flex;
        gap: 1rem;
        border-bottom: 2px solid #f0f0f0;
        background: white;
        padding: 0 2rem;
        border-radius: 10px 10px 0 0;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }

      .tab {
        padding: 1rem 2rem;
        background: none;
        border: none;
        cursor: pointer;
        font-weight: 500;
        color: #666;
        transition: all 0.3s;
        border-bottom: 3px solid transparent;
        position: relative;
        top: 2px;
      }

      .tab.active {
        color: #667eea;
        border-bottom-color: #667eea;
      }

      .tab:hover {
        color: #667eea;
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

      .form-section {
        padding: 1rem 0;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;
      }

      .form-group.full-width {
        grid-column: 1 / -1;
      }

      .form-group label {
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: #333;
      }

      .form-group input,
      .form-group select,
      .form-group textarea {
        padding: 0.6rem;
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        font-size: 1rem;
      }

      .form-group input:focus,
      .form-group select:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: #667eea;
      }

      .form-group small {
        display: block;
        margin-top: 0.25rem;
      }

      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .modal-content {
        background: white;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
      }

      .modal-header {
        padding: 1.5rem;
        border-bottom: 2px solid #f0f0f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 10px 10px 0 0;
      }

      .modal-header h3 {
        margin: 0;
        color: #333;
        font-size: 1.3rem;
      }

      .modal-header.modal-info {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .modal-header.modal-info h3 {
        color: white;
      }

      .modal-header.modal-success {
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        color: white;
      }

      .modal-header.modal-success h3 {
        color: white;
      }

      .modal-header.modal-error {
        background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
        color: white;
      }

      .modal-header.modal-error h3 {
        color: white;
      }

      .modal-header.modal-confirm {
        background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
        color: white;
      }

      .modal-header.modal-confirm h3 {
        color: white;
      }

      .modal-close {
        background: none;
        border: none;
        font-size: 2rem;
        cursor: pointer;
        color: inherit;
        line-height: 1;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-body {
        padding: 1.5rem;
        color: #333;
      }

      .modal-footer {
        padding: 1rem 1.5rem;
        border-top: 2px solid #f0f0f0;
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }

      .btn-danger {
        background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
        color: white;
        border: none;
        box-shadow: 0 2px 8px rgba(244, 67, 54, 0.4);
        font-weight: 600;
        letter-spacing: 0.3px;
      }

      .btn-danger:hover:not(:disabled) {
        background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(244, 67, 54, 0.5);
      }

      .btn-danger:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 2px 6px rgba(244, 67, 54, 0.4);
      }

      .btn-danger:disabled {
        background: #ccc;
        color: #666;
        cursor: not-allowed;
        opacity: 0.6;
        box-shadow: none;
      }

      .equipment-dropdown-container {
        position: relative;
      }

      .equipment-dropdown {
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        padding: 0.8rem;
        background-color: white;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 2.5rem;
        transition: all 0.3s;
      }

      .equipment-dropdown:hover {
        border-color: #667eea;
      }

      .equipment-dropdown:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .dropdown-placeholder {
        color: #999;
      }

      .dropdown-selected {
        color: #333;
        flex: 1;
      }

      .dropdown-arrow {
        color: #667eea;
        font-size: 0.8rem;
        transition: transform 0.3s;
        margin-left: 0.5rem;
      }

      .equipment-dropdown-container:has(.equipment-dropdown-menu) .dropdown-arrow {
        transform: rotate(180deg);
      }

      .equipment-dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 0.25rem;
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        background-color: white;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        max-height: 250px;
        overflow-y: auto;
        z-index: 1000;
      }

      .equipment-dropdown-item {
        padding: 0.75rem 1rem;
        cursor: pointer;
        border-bottom: 1px solid #f0f0f0;
        transition: background-color 0.2s;
      }

      .equipment-dropdown-item:last-child {
        border-bottom: none;
      }

      .equipment-dropdown-item:hover {
        background-color: #f0f4ff;
      }

      .equipment-dropdown-item.selected {
        background-color: #e3f2fd;
        color: #1976d2;
        font-weight: 500;
      }

      .equipment-dropdown-item.selected:hover {
        background-color: #bbdefb;
      }

      .no-equipment {
        text-align: center;
        padding: 1rem;
        color: #999;
      }

      .available-slots {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 0.5rem;
        margin-top: 0.5rem;
        max-height: 300px;
        overflow-y: auto;
        padding: 0.5rem;
        background-color: #fafafa;
        border-radius: 5px;
      }

      .slot-item {
        padding: 0.75rem 1rem;
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        background-color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.9rem;
      }

      .slot-item:hover:not(.occupied) {
        border-color: #667eea;
        background-color: #f0f4ff;
        transform: translateY(-2px);
        box-shadow: 0 2px 5px rgba(102, 126, 234, 0.2);
      }

      .slot-item.selected {
        border-color: #4CAF50;
        background-color: #e8f5e9;
        color: #2e7d32;
        font-weight: 600;
      }

      .slot-item.occupied {
        background-color: #ffebee;
        border-color: #f44336;
        color: #c62828;
        cursor: not-allowed;
        opacity: 0.7;
      }

      .occupied-badge {
        font-size: 0.7rem;
        background-color: #f44336;
        color: white;
        padding: 0.2rem 0.5rem;
        border-radius: 10px;
      }
    `,
  ],
})
export class AppointmentsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  appointments: Appointment[] = [];
  appointmentsByDay: Map<string, Appointment[]> = new Map();
  patients: PatientProfile[] = [];
  professionals: ProfessionalProfile[] = [];
  currentProfessionalId: number | null = null;
  rooms: Room[] = [];
  services: Service[] = [];
  showNewAppointmentForm = false;
  showEditAppointmentForm = false;
  selectedAppointment: Appointment | null = null;
  currentDate = new Date();
  weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  activeTab = 'my-appointments';
  requesting = false;
  showTreatmentTypeDropdown = false;
  showTreatmentTypeDropdownForForm = false;
  showTreatmentTypeDropdownForEdit = false;
  
  // Disponibilidad
  selectedDate: string = '';
  selectedProfessionalId: number | null = null;
  availableSlots: any[] = [];
  selectedSlot: any = null;
  loadingAvailability = false;
  selectedProfessionalForAvailability: number | null = null;
  availabilityByDay: Map<string, any[]> = new Map();
  
  // Modal states
  showModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'info' | 'confirm' | 'success' | 'error' = 'info';
  modalCallback: (() => void) | null = null;

  form = this.fb.nonNullable.group({
    patient_id: ['', Validators.required],
    professional_id: ['', Validators.required],
    room_id: ['', Validators.required],
    start_time: ['', Validators.required],
    treatment_type: ['', Validators.required],
    notes: [''],
  });

  requestForm = this.fb.nonNullable.group({
    professional_id: ['', Validators.required],
    start_time: ['', Validators.required],
    treatment_type: ['', Validators.required],
    notes: [''],
  });

  editForm = this.fb.nonNullable.group({
    patient_id: ['', Validators.required],
    professional_id: ['', Validators.required],
    room_id: ['', Validators.required],
    start_time: ['', Validators.required],
    treatment_type: ['', Validators.required],
    notes: [''],
  });

  get currentMonth(): string {
    return this.currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }

  get calendarDays(): Date[] {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];
    
    // Añadir días del mes anterior para completar la semana
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    
    // Añadir días del mes actual
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    
    // Añadir días del mes siguiente para completar la semana
    const remaining = 42 - days.length;
    for (let day = 1; day <= remaining; day++) {
      days.push(new Date(year, month + 1, day));
    }
    
    return days;
  }

  get todayAppointments(): Appointment[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.appointments.filter(apt => {
      const aptDate = new Date(apt.start_time);
      aptDate.setHours(0, 0, 0, 0);
      return aptDate.getTime() === today.getTime();
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }


  ngOnInit() {
    this.refresh();
    this.api.getPatients().subscribe((patients) => (this.patients = patients));
    this.api.getProfessionals().subscribe((pros) => {
      this.professionals = pros;
      // Si es profesional, obtener su ID
      if (this.isProfessional()) {
        const currentUser = this.auth.getCurrentUser();
        if (currentUser) {
          // Buscar el profesional por ID de usuario
          const currentPro = pros.find(p => p.user && p.user.id === currentUser.id);
          if (currentPro) {
            this.currentProfessionalId = currentPro.id;
          } else {
            // Si no se encuentra, intentar buscar por username o email como fallback
            const currentProByUsername = pros.find(p => 
              p.user && (
                p.user.username === currentUser.username || 
                p.user.email === currentUser.email
              )
            );
            if (currentProByUsername) {
              this.currentProfessionalId = currentProByUsername.id;
            }
          }
        }
      }
      // Si es paciente, seleccionar el primer profesional por defecto y cargar disponibilidad
      if (this.isPatient() && this.activeTab === 'available' && pros.length > 0) {
        this.selectedProfessionalForAvailability = pros[0].id;
        setTimeout(() => this.loadAvailabilityForCalendar(), 500);
      }
    });
    this.api.getRooms().subscribe((rooms) => (this.rooms = rooms));
    this.api.getServices().subscribe((services) => (this.services = services.filter(s => s.is_active)));
    // Inicializar el mapa de citas por día
    this.updateAppointmentsByDay();
  }

  refresh() {
    console.log('Refrescando citas...');
    this.api.getAppointments().subscribe({
      next: (appointments) => {
        console.log('Citas recibidas del backend:', appointments.length);
        console.log('IDs de citas recibidas:', appointments.map(a => a.id));
        
        // Limpiar completamente
        this.appointments = [];
        this.appointmentsByDay.clear();
        
        // Crear un nuevo array completamente nuevo
        this.appointments = appointments.map(apt => {
          return {
            id: apt.id,
            patient: apt.patient,
            professional: apt.professional,
            room: apt.room,
            start_time: apt.start_time,
            end_time: apt.end_time,
            status: apt.status,
            treatment_type: apt.treatment_type,
            notes: apt.notes,
            version: apt.version
          };
        });
        
        // Ordenar las citas por fecha
        this.appointments.sort((a, b) => 
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
        
        console.log('Citas después de ordenar:', this.appointments.length);
        console.log('IDs de citas después de ordenar:', this.appointments.map(a => a.id));
        
        // Actualizar el mapa de citas por día
        this.updateAppointmentsByDay();
        console.log('Mapa de citas por día actualizado. Tamaño:', this.appointmentsByDay.size);
        
        // Forzar actualización completa del componente
        this.cdr.markForCheck();
        
        // Forzar actualización del calendario cambiando currentDate
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const day = this.currentDate.getDate();
        // Cambiar a un nuevo objeto Date para forzar detección de cambios
        this.currentDate = new Date(year, month, day);
        
        // Usar setTimeout para asegurar que Angular procese el cambio
        setTimeout(() => {
          this.cdr.detectChanges();
        }, 100);
      },
      error: (err) => {
        console.error('Error al refrescar citas:', err);
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = 'Error al actualizar las citas. Por favor, intente nuevamente.';
        this.modalCallback = null;
      }
    });
  }

  getMinDateTime(): string {
    const now = new Date();
    // Formato para datetime-local: YYYY-MM-DDTHH:mm
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  getMaxDateTime(): string {
    const now = new Date();
    // Añadir 3 meses
    const maxDate = new Date(now);
    maxDate.setMonth(maxDate.getMonth() + 3);
    // Formato para datetime-local: YYYY-MM-DDTHH:mm
    const year = maxDate.getFullYear();
    const month = String(maxDate.getMonth() + 1).padStart(2, '0');
    const day = String(maxDate.getDate()).padStart(2, '0');
    const hours = String(23).padStart(2, '0');
    const minutes = String(59).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  isValidStartTime(dateString: string): boolean {
    if (!dateString) return true;
    const selectedDate = new Date(dateString);
    const now = new Date();
    const maxDate = new Date(now);
    maxDate.setMonth(maxDate.getMonth() + 3);
    
    // No puede ser en el pasado
    if (selectedDate < now) {
      return false;
    }
    
    // No puede ser más de 3 meses en el futuro
    if (selectedDate > maxDate) {
      return false;
    }
    
    return true;
  }

  getStartTimeErrorMessage(): string {
    const startTime = this.form.get('start_time')?.value;
    if (!startTime) return '';
    
    if (!this.isValidStartTime(startTime)) {
      const selectedDate = new Date(startTime);
      const now = new Date();
      const maxDate = new Date(now);
      maxDate.setMonth(maxDate.getMonth() + 3);
      
      if (selectedDate < now) {
        return 'La fecha seleccionada no es válida.';
      }
      if (selectedDate > maxDate) {
        return 'La fecha seleccionada no es válida.';
      }
    }
    return '';
  }

  getRequestStartTimeErrorMessage(): string {
    const startTime = this.requestForm.get('start_time')?.value;
    if (!startTime) return '';
    
    if (!this.isValidStartTime(startTime)) {
      const selectedDate = new Date(startTime);
      const now = new Date();
      const maxDate = new Date(now);
      maxDate.setMonth(maxDate.getMonth() + 3);
      
      if (selectedDate < now) {
        return 'La fecha seleccionada no es válida.';
      }
      if (selectedDate > maxDate) {
        return 'La fecha seleccionada no es válida.';
      }
    }
    return '';
  }

  onStartTimeChange() {
    // Validar la fecha seleccionada
    const startTime = this.form.get('start_time')?.value;
    if (startTime && !this.isValidStartTime(startTime)) {
      this.form.get('start_time')?.setErrors({ invalidDate: true });
    } else {
      this.form.get('start_time')?.setErrors(null);
    }
    // La fecha fin se calculará automáticamente en el backend
  }

  onRequestStartTimeChange() {
    // Validar la fecha seleccionada
    const startTime = this.requestForm.get('start_time')?.value;
    if (startTime && !this.isValidStartTime(startTime)) {
      this.requestForm.get('start_time')?.setErrors({ invalidDate: true });
    } else {
      this.requestForm.get('start_time')?.setErrors(null);
    }
    // La fecha fin se calculará automáticamente en el backend
  }

  createAppointment() {
    // Marcar todos los campos como touched para mostrar errores
    Object.keys(this.form.controls).forEach(key => {
      this.form.get(key)?.markAsTouched();
    });

    if (this.form.invalid) {
      // Mostrar errores específicos
      const errors: string[] = [];
      if (this.form.get('patient_id')?.hasError('required')) {
        errors.push('El paciente es requerido');
      }
      if (this.form.get('professional_id')?.hasError('required')) {
        errors.push('El profesional es requerido');
      }
      if (this.form.get('room_id')?.hasError('required')) {
        errors.push('La sala es requerida');
      }
      if (this.form.get('start_time')?.hasError('required')) {
        errors.push('La fecha y hora de inicio son requeridas');
      }
      if (this.form.get('treatment_type')?.hasError('required')) {
        errors.push('El tipo de tratamiento es requerido');
      }
      
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error de Validación';
      this.modalMessage = errors.length > 0 ? errors.join('\n') : 'Por favor, complete todos los campos obligatorios.';
      this.modalCallback = null;
      return;
    }
    
    const formValue = this.form.getRawValue();
    
    // Validar que los valores no estén vacíos
    if (!formValue.patient_id || formValue.patient_id === '') {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Por favor, seleccione un paciente.';
      this.modalCallback = null;
      return;
    }

    if (!formValue.professional_id || formValue.professional_id === '') {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Por favor, seleccione un profesional.';
      this.modalCallback = null;
      return;
    }

    if (!formValue.room_id || formValue.room_id === '') {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Por favor, seleccione una sala.';
      this.modalCallback = null;
      return;
    }

    if (!formValue.start_time || formValue.start_time === '') {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Por favor, seleccione una fecha y hora de inicio.';
      this.modalCallback = null;
      return;
    }

    if (!formValue.treatment_type || formValue.treatment_type === '') {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Por favor, seleccione un tipo de tratamiento.';
      this.modalCallback = null;
      return;
    }
    
    // Convertir IDs a números
    const patientId = typeof formValue.patient_id === 'string' ? parseInt(formValue.patient_id, 10) : formValue.patient_id;
    const professionalId = typeof formValue.professional_id === 'string' ? parseInt(formValue.professional_id, 10) : formValue.professional_id;
    const roomId = typeof formValue.room_id === 'string' ? parseInt(formValue.room_id, 10) : formValue.room_id;
    
    const startTime = new Date(formValue.start_time);
    if (isNaN(startTime.getTime())) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'La fecha y hora seleccionadas no son válidas.';
      this.modalCallback = null;
      return;
    }
    
    // Validar que la fecha no sea en el pasado ni más de 3 meses en el futuro
    if (!this.isValidStartTime(formValue.start_time)) {
      const now = new Date();
      const maxDate = new Date(now);
      maxDate.setMonth(maxDate.getMonth() + 3);
      
      let errorMsg = 'La fecha seleccionada no es válida.';
      if (startTime < now) {
        errorMsg = 'La fecha seleccionada no es válida.';
      } else if (startTime > maxDate) {
        errorMsg = 'La fecha seleccionada no es válida.';
      }
      
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = errorMsg;
      this.modalCallback = null;
      return;
    }
    
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    
    // Verificar conflictos antes de crear
    this.checkAppointmentConflict({
      professional_id: professionalId,
      room_id: roomId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
    }, () => {
      // No enviar end_time, el backend lo calculará automáticamente
      const payload: any = {
        patient_id: patientId,
        professional_id: professionalId,
        room_id: roomId,
        start_time: startTime.toISOString(),
        treatment_type: formValue.treatment_type,
      };
      
      // Solo incluir notes si tiene valor
      if (formValue.notes && formValue.notes.trim() !== '') {
        payload.notes = formValue.notes.trim();
      }
      
      console.log('Enviando payload:', payload);
      
      this.api.createAppointment(payload).subscribe({
        next: (createdAppointment) => {
          console.log('Cita creada:', createdAppointment);
          this.form.reset();
          this.showNewAppointmentForm = false;
          
          // Llamar directamente a refresh() que ya tiene toda la lógica
          setTimeout(() => {
            this.refresh();
            this.showModal = true;
            this.modalType = 'success';
            this.modalTitle = 'Éxito';
            this.modalMessage = 'Cita creada correctamente.';
            this.modalCallback = null;
          }, 500); // Esperar 500ms antes de refrescar
        },
        error: (err) => {
          console.error('Error completo al crear cita:', err);
          console.error('Error response:', err.error);
          let errorMessage = 'Error al crear la cita.';
          
          if (err.error) {
            // Si es un string directo
            if (typeof err.error === 'string') {
              errorMessage = err.error;
            }
            // Si tiene detail
            else if (err.error.detail) {
              errorMessage = err.error.detail;
            }
            // Si es un objeto con errores de validación
            else if (typeof err.error === 'object') {
              const errorKeys = Object.keys(err.error);
              if (errorKeys.length > 0) {
                const errorMessages: string[] = [];
                errorKeys.forEach(key => {
                  const fieldError = err.error[key];
                  if (Array.isArray(fieldError)) {
                    // Si es non_field_errors, mostrar directamente sin el prefijo
                    if (key === 'non_field_errors') {
                      errorMessages.push(...fieldError);
                    } else {
                      errorMessages.push(`${key}: ${fieldError.join(', ')}`);
                    }
                  } else if (typeof fieldError === 'string') {
                    // Si es non_field_errors, mostrar directamente sin el prefijo
                    if (key === 'non_field_errors') {
                      errorMessages.push(fieldError);
                    } else {
                      errorMessages.push(`${key}: ${fieldError}`);
                    }
                  } else if (typeof fieldError === 'object') {
                    errorMessages.push(`${key}: ${JSON.stringify(fieldError)}`);
                  }
                });
                errorMessage = errorMessages.join('\n');
              }
            }
          }
          
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = errorMessage;
          this.modalCallback = null;
        }
      });
    });
  }

  checkAppointmentConflict(payload: any, onSuccess: () => void) {
    // La validación de conflictos se hace en el backend, solo mostramos una advertencia si hay solapamiento obvio
    // Pero permitimos que el backend haga la validación final ya que puede haber múltiples citas en el mismo día
    // siempre que no se solapen en tiempo para el mismo profesional o sala
    onSuccess();
  }

  previousMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    if (this.isPatient() && this.activeTab === 'available') {
      this.loadAvailabilityForCalendar();
    }
  }

  nextMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    if (this.isPatient() && this.activeTab === 'available') {
      this.loadAvailabilityForCalendar();
    }
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  private updateAppointmentsByDay() {
    this.appointmentsByDay.clear();
    if (!this.appointments || this.appointments.length === 0) {
      return;
    }
    
    this.appointments.forEach(apt => {
      if (!apt || !apt.start_time) return;
      const aptDate = new Date(apt.start_time);
      const dayKey = `${aptDate.getFullYear()}-${aptDate.getMonth()}-${aptDate.getDate()}`;
      
      if (!this.appointmentsByDay.has(dayKey)) {
        this.appointmentsByDay.set(dayKey, []);
      }
      this.appointmentsByDay.get(dayKey)!.push(apt);
    });
  }

  getAppointmentsForDay(day: Date): Appointment[] {
    const dayKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    const appointments = this.appointmentsByDay.get(dayKey) || [];
    return appointments;
  }

  loadAvailabilityForCalendar() {
    if (!this.isPatient() || !this.selectedProfessionalForAvailability) return;
    
    this.availabilityByDay.clear();
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    let loadedDays = 0;
    const totalDays = lastDay;
    
    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split('T')[0];
      
      // Solo cargar días futuros o de hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) continue;
      
      // Cargar para el profesional seleccionado
      this.api.getAppointmentAvailability(this.selectedProfessionalForAvailability, dateString).subscribe({
        next: (response: any) => {
          const occupiedSlots = response.occupied_slots || [];
          const daySlots = this.calculateAvailableSlots(dateString, occupiedSlots);
          
          const dayKey = date.toDateString();
          const existing = this.availabilityByDay.get(dayKey) || [];
          this.availabilityByDay.set(dayKey, [...existing, ...daySlots.filter(s => !s.occupied)]);
          
          loadedDays++;
          if (loadedDays === totalDays) {
            this.cdr.detectChanges();
          }
        },
        error: (err: any) => {
          console.error(`Error al cargar disponibilidad para ${dateString}:`, err);
        }
      });
    }
  }

  getAvailableSlotsForDay(day: Date): any[] {
    const dayKey = day.toDateString();
    const slots = this.availabilityByDay.get(dayKey) || [];
    
    // Filtrar slots que tengan al menos 24 horas de anticipación
    const now = new Date();
    const minDateTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas en milisegundos
    
    const filteredSlots = slots.filter(slot => {
      const slotDate = new Date(slot.start);
      // Solo mostrar slots que tengan al menos 24 horas de anticipación
      return slotDate >= minDateTime;
    });
    
    // Ordenar por hora
    return filteredSlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  selectAvailableSlot(slot: any, day: Date) {
    // Abrir formulario de solicitar cita con los datos prellenados
    this.switchToTab('request');
    
    // Usar la fecha del día seleccionado directamente (no del slot para evitar problemas de zona horaria)
    // El parámetro 'day' ya viene como Date del calendario, usarlo directamente
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const date = String(day.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${date}`;
    
    // Buscar el profesional del slot (si está disponible)
    if (this.selectedProfessionalForAvailability) {
      this.requestForm.patchValue({ professional_id: this.selectedProfessionalForAvailability.toString() });
      this.selectedProfessionalId = this.selectedProfessionalForAvailability;
      
      // Cargar los slots disponibles para la fecha seleccionada
      this.loadAvailableSlots();
      
      // Esperar a que se carguen los slots y luego seleccionar el slot correspondiente
      setTimeout(() => {
        // Buscar el slot que coincida con el horario seleccionado
        const slotStartTime = new Date(slot.start);
        const slotHour = slotStartTime.getHours();
        const slotMinutes = slotStartTime.getMinutes();
        
        const matchingSlot = this.availableSlots.find(s => {
          const sDate = new Date(s.start);
          // Comparar hora y minutos
          return sDate.getHours() === slotHour && sDate.getMinutes() === slotMinutes;
        });
        
        if (matchingSlot && !matchingSlot.occupied) {
          this.selectedSlot = matchingSlot;
          // Usar la fecha del día seleccionado y la hora del slot
          const localDate = new Date(year, day.getMonth(), day.getDate(), slotHour, slotMinutes);
          const localYear = localDate.getFullYear();
          const localMonth = String(localDate.getMonth() + 1).padStart(2, '0');
          const localDay = String(localDate.getDate()).padStart(2, '0');
          const localHours = String(localDate.getHours()).padStart(2, '0');
          const localMinutes = String(localDate.getMinutes()).padStart(2, '0');
          const dateTimeString = `${localYear}-${localMonth}-${localDay}T${localHours}:${localMinutes}`;
          
          this.requestForm.patchValue({ start_time: dateTimeString });
          this.requestForm.get('start_time')?.markAsTouched();
          this.requestForm.get('start_time')?.updateValueAndValidity();
        } else {
          // Si no se encuentra o está ocupado, usar el slot original
          this.selectedSlot = slot;
          const slotDate = new Date(slot.start);
          const localDate = new Date(year, day.getMonth(), day.getDate(), slotDate.getHours(), slotDate.getMinutes());
          const localYear = localDate.getFullYear();
          const localMonth = String(localDate.getMonth() + 1).padStart(2, '0');
          const localDay = String(localDate.getDate()).padStart(2, '0');
          const localHours = String(localDate.getHours()).padStart(2, '0');
          const localMinutes = String(localDate.getMinutes()).padStart(2, '0');
          const dateTimeString = `${localYear}-${localMonth}-${localDay}T${localHours}:${localMinutes}`;
          
          this.requestForm.patchValue({ start_time: dateTimeString });
          this.requestForm.get('start_time')?.markAsTouched();
          this.requestForm.get('start_time')?.updateValueAndValidity();
        }
      }, 500);
    } else {
      // Si no hay profesional, establecer directamente el slot
      this.selectedSlot = slot;
      
      // Usar la fecha del día seleccionado y la hora del slot
      const slotDate = new Date(slot.start);
      const localDate = new Date(year, day.getMonth(), day.getDate(), slotDate.getHours(), slotDate.getMinutes());
      const localYear = localDate.getFullYear();
      const localMonth = String(localDate.getMonth() + 1).padStart(2, '0');
      const localDay = String(localDate.getDate()).padStart(2, '0');
      const localHours = String(localDate.getHours()).padStart(2, '0');
      const localMinutes = String(localDate.getMinutes()).padStart(2, '0');
      const dateTimeString = `${localYear}-${localMonth}-${localDay}T${localHours}:${localMinutes}`;
      
      this.requestForm.patchValue({ start_time: dateTimeString });
      this.requestForm.get('start_time')?.markAsTouched();
      this.requestForm.get('start_time')?.updateValueAndValidity();
    }
  }

  switchToTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'available' && this.isPatient()) {
      // Si no hay profesional seleccionado, seleccionar el primero
      if (!this.selectedProfessionalForAvailability && this.professionals.length > 0) {
        this.selectedProfessionalForAvailability = this.professionals[0].id;
      }
      setTimeout(() => this.loadAvailabilityForCalendar(), 100);
    }
  }

  trackByAppointmentId(index: number, appointment: Appointment): any {
    return appointment.id || index;
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

  selectAppointment(appointment: Appointment) {
    this.selectedAppointment = appointment;
    this.showEditAppointmentForm = true;
    this.showNewAppointmentForm = false;
    
    // Formatear la fecha para el input datetime-local
    const startTime = new Date(appointment.start_time);
    const year = startTime.getFullYear();
    const month = String(startTime.getMonth() + 1).padStart(2, '0');
    const day = String(startTime.getDate()).padStart(2, '0');
    const hours = String(startTime.getHours()).padStart(2, '0');
    const minutes = String(startTime.getMinutes()).padStart(2, '0');
    const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    // Rellenar el formulario con los datos de la cita
    this.editForm.patchValue({
      patient_id: appointment.patient.id.toString(),
      professional_id: appointment.professional.id.toString(),
      room_id: appointment.room.id.toString(),
      start_time: formattedDateTime,
      treatment_type: appointment.treatment_type,
      notes: appointment.notes || '',
    });
  }

  cancelEdit() {
    this.showEditAppointmentForm = false;
    this.selectedAppointment = null;
    this.editForm.reset();
  }

  updateAppointment() {
    if (!this.selectedAppointment) return;
    
    // Marcar todos los campos como touched
    Object.keys(this.editForm.controls).forEach(key => {
      this.editForm.get(key)?.markAsTouched();
    });

    if (this.editForm.invalid) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error de Validación';
      this.modalMessage = 'Por favor, complete todos los campos obligatorios.';
      this.modalCallback = null;
      return;
    }

    const formValue = this.editForm.getRawValue();
    const startTime = new Date(formValue.start_time);
    
    if (isNaN(startTime.getTime())) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'La fecha y hora seleccionadas no son válidas.';
      this.modalCallback = null;
      return;
    }
    
    // Validar que la fecha no sea en el pasado ni más de 3 meses en el futuro
    if (!this.isValidStartTime(formValue.start_time)) {
      const now = new Date();
      const maxDate = new Date(now);
      maxDate.setMonth(maxDate.getMonth() + 3);
      
      let errorMsg = 'La fecha seleccionada no es válida.';
      if (startTime < now) {
        errorMsg = 'La fecha seleccionada no es válida.';
      } else if (startTime > maxDate) {
        errorMsg = 'La fecha seleccionada no es válida.';
      }
      
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = errorMsg;
      this.modalCallback = null;
      return;
    }

    const payload: any = {
      patient_id: parseInt(formValue.patient_id, 10),
      professional_id: parseInt(formValue.professional_id, 10),
      room_id: parseInt(formValue.room_id, 10),
      start_time: startTime.toISOString(),
      treatment_type: formValue.treatment_type,
      version: this.selectedAppointment.version,
    };
    
    if (formValue.notes && formValue.notes.trim() !== '') {
      payload.notes = formValue.notes.trim();
    }

    this.api.updateAppointment(this.selectedAppointment.id, payload).subscribe({
      next: (updatedAppointment) => {
        console.log('Cita actualizada:', updatedAppointment);
        this.cancelEdit();
        
        // Refrescar las citas
        setTimeout(() => {
          this.refresh();
          this.showModal = true;
          this.modalType = 'success';
          this.modalTitle = 'Éxito';
          this.modalMessage = 'Cita actualizada correctamente.';
          this.modalCallback = null;
        }, 500);
      },
      error: (err) => {
        console.error('Error al actualizar cita:', err);
        let errorMessage = 'Error al actualizar la cita.';
        
        if (err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (err.error.detail) {
            errorMessage = err.error.detail;
          } else if (typeof err.error === 'object') {
            const errorKeys = Object.keys(err.error);
            if (errorKeys.length > 0) {
              const errorMessages: string[] = [];
              errorKeys.forEach(key => {
                const fieldError = err.error[key];
                if (Array.isArray(fieldError)) {
                  if (key === 'non_field_errors') {
                    errorMessages.push(...fieldError);
                  } else {
                    errorMessages.push(`${key}: ${fieldError.join(', ')}`);
                  }
                } else if (typeof fieldError === 'string') {
                  if (key === 'non_field_errors') {
                    errorMessages.push(fieldError);
                  } else {
                    errorMessages.push(`${key}: ${fieldError}`);
                  }
                }
              });
              errorMessage = errorMessages.join('\n');
            }
          }
        }
        
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = errorMessage;
        this.modalCallback = null;
      }
    });
  }

  confirmDeleteAppointment() {
    if (!this.selectedAppointment) return;
    
    // Verificar si la cita ya pasó
    if (this.isPastAppointment()) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'No se puede eliminar';
      this.modalMessage = 'Las citas realizadas se conservan para mantener el historial.';
      this.modalCallback = null;
      return;
    }
    
    this.showModal = true;
    this.modalType = 'confirm';
    this.modalTitle = 'Confirmar Eliminación';
    this.modalMessage = '¿Está seguro de que desea eliminar esta cita? Esta acción no se puede deshacer.';
    this.modalCallback = () => this.deleteAppointment();
  }

  isPastAppointment(): boolean {
    if (!this.selectedAppointment) return false;
    const appointmentDate = new Date(this.selectedAppointment.start_time);
    const now = new Date();
    return appointmentDate < now;
  }

  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  isProfessional(): boolean {
    return this.auth.isProfessional();
  }

  approveAppointment() {
    if (!this.selectedAppointment) return;

    this.showModal = true;
    this.modalType = 'confirm';
    this.modalTitle = 'Confirmar Aceptación';
    this.modalMessage = `¿Está seguro de que desea aceptar esta cita?\n\nLa cita será confirmada y el paciente recibirá una notificación.`;
    this.modalCallback = () => {
      this.api.approveAppointment(this.selectedAppointment!.id).subscribe({
        next: () => {
          this.showModal = false;
          if (this.selectedAppointment) {
            this.selectedAppointment.status = 'CONFIRMED';
          }
          setTimeout(() => {
            this.refresh();
            this.showModal = true;
            this.modalType = 'success';
            this.modalTitle = 'Éxito';
            this.modalMessage = 'Cita aceptada y confirmada correctamente.';
            this.modalCallback = null;
          }, 500);
        },
        error: (err) => {
          console.error('Error al aceptar cita:', err);
          let errorMessage = 'Error al aceptar la cita.';
          if (err.error) {
            if (typeof err.error === 'string') {
              errorMessage = err.error;
            } else if (err.error.detail) {
              errorMessage = err.error.detail;
            } else if (err.error.error) {
              errorMessage = err.error.error;
            }
          }
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = errorMessage;
          this.modalCallback = null;
        }
      });
    };
  }

  deleteAppointment() {
    if (!this.selectedAppointment) return;

    this.api.deleteAppointment(this.selectedAppointment.id).subscribe({
      next: () => {
        console.log('Cita eliminada');
        this.cancelEdit();
        
        // Refrescar las citas
        setTimeout(() => {
          this.refresh();
          this.showModal = true;
          this.modalType = 'success';
          this.modalTitle = 'Éxito';
          this.modalMessage = 'Cita eliminada correctamente.';
          this.modalCallback = null;
        }, 500);
      },
      error: (err) => {
        console.error('Error al eliminar cita:', err);
        let errorMessage = 'Error al eliminar la cita.';
        
        if (err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (err.error.detail) {
            errorMessage = err.error.detail;
          }
        }
        
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = errorMessage;
        this.modalCallback = null;
      }
    });
  }

  getEditStartTimeErrorMessage(): string {
    const startTime = this.editForm.get('start_time')?.value;
    if (!startTime) return '';
    
    if (!this.isValidStartTime(startTime)) {
      const selectedDate = new Date(startTime);
      const now = new Date();
      const maxDate = new Date(now);
      maxDate.setMonth(maxDate.getMonth() + 3);
      
      if (selectedDate < now) {
        return 'La fecha seleccionada no es válida.';
      }
      if (selectedDate > maxDate) {
        return 'La fecha seleccionada no es válida.';
      }
    }
    return '';
  }

  onEditStartTimeChange() {
    const startTime = this.editForm.get('start_time')?.value;
    if (startTime && !this.isValidStartTime(startTime)) {
      this.editForm.get('start_time')?.setErrors({ invalidDate: true });
    } else {
      this.editForm.get('start_time')?.setErrors(null);
    }
  }

  toggleTreatmentTypeDropdownForEdit() {
    this.showTreatmentTypeDropdownForEdit = !this.showTreatmentTypeDropdownForEdit;
  }

  selectTreatmentTypeForEdit(serviceName: string) {
    this.editForm.patchValue({ treatment_type: serviceName });
    this.editForm.get('treatment_type')?.markAsTouched();
    this.editForm.get('treatment_type')?.updateValueAndValidity();
    this.showTreatmentTypeDropdownForEdit = false;
  }

  isPatient(): boolean {
    return this.auth.isPatient();
  }

  getMinDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  getMaxDate(): string {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return maxDate.toISOString().split('T')[0];
  }

  onProfessionalSelected() {
    // Limpiar el slot seleccionado cuando se cambia el profesional
    this.selectedSlot = null;
    this.requestForm.patchValue({ start_time: '' });
    
    const professionalId = this.requestForm.get('professional_id')?.value;
    if (professionalId) {
      this.selectedProfessionalId = typeof professionalId === 'string' ? parseInt(professionalId, 10) : professionalId;
      if (this.selectedDate) {
        this.loadAvailableSlots();
      }
    } else {
      this.selectedProfessionalId = null;
      this.availableSlots = [];
    }
  }

  onDateSelected() {
    // Limpiar el slot seleccionado cuando se cambia la fecha
    this.selectedSlot = null;
    this.requestForm.patchValue({ start_time: '' });
    
    if (this.selectedDate && this.selectedProfessionalId) {
      this.loadAvailableSlots();
    } else if (this.selectedDate) {
      this.availableSlots = [];
    }
  }

  loadAvailableSlots() {
    if (!this.selectedDate || !this.selectedProfessionalId) return;

    this.loadingAvailability = true;
    const professionalId = this.selectedProfessionalId;
    const date = this.selectedDate;

    this.api.getAppointmentAvailability(professionalId, date).subscribe({
      next: (response: any) => {
        const occupiedSlots = response.occupied_slots || [];
        this.availableSlots = this.calculateAvailableSlots(date, occupiedSlots);
        this.loadingAvailability = false;
      },
      error: (err: any) => {
        console.error('Error al cargar disponibilidad:', err);
        // Si hay error, calcular slots básicos sin verificar ocupados
        this.availableSlots = this.calculateAvailableSlots(date, []);
        this.loadingAvailability = false;
      }
    });
  }

  calculateAvailableSlots(date: string, occupiedSlots: any[]): any[] {
    const slots: any[] = [];
    const selectedDate = new Date(date);
    
    // Horarios de trabajo: 9:00 a 18:00 (cada hora)
    const startHour = 9;
    const endHour = 18;
    
    // Calcular la fecha/hora mínima (24 horas desde ahora)
    const now = new Date();
    const minDateTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas en milisegundos

    for (let hour = startHour; hour < endHour; hour++) {
      const slotDate = new Date(selectedDate);
      slotDate.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotDate);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      // Filtrar slots que no tengan al menos 24 horas de anticipación
      // Si el slot es anterior a minDateTime, no mostrarlo
      if (slotDate < minDateTime) {
        continue;
      }

      // Verificar si el slot está ocupado
      const isOccupied = occupiedSlots.some(occupied => {
        const occupiedStart = new Date(occupied.start);
        const occupiedEnd = new Date(occupied.end);
        return (slotDate < occupiedEnd && slotEnd > occupiedStart);
      });

      slots.push({
        start: slotDate.toISOString(),
        end: slotEnd.toISOString(),
        occupied: isOccupied
      });
    }

    return slots;
  }

  selectTimeSlot(slot: any) {
    if (slot.occupied) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Horario Ocupado';
      this.modalMessage = `Este horario (${this.formatTimeSlot(slot.start)}) ya está ocupado. Por favor, seleccione otro horario disponible.`;
      this.modalCallback = null;
      return;
    }

    this.selectedSlot = slot;
    // Convertir la fecha del slot a formato local para el input datetime-local
    // El input datetime-local espera formato YYYY-MM-DDTHH:mm en hora local
    const localDate = new Date(slot.start);
    const localYear = localDate.getFullYear();
    const localMonth = String(localDate.getMonth() + 1).padStart(2, '0');
    const localDay = String(localDate.getDate()).padStart(2, '0');
    const localHours = String(localDate.getHours()).padStart(2, '0');
    const localMinutes = String(localDate.getMinutes()).padStart(2, '0');
    const dateTimeString = `${localYear}-${localMonth}-${localDay}T${localHours}:${localMinutes}`;
    
    this.requestForm.patchValue({ start_time: dateTimeString });
    this.requestForm.get('start_time')?.markAsTouched();
    this.requestForm.get('start_time')?.updateValueAndValidity();
  }

  formatTimeSlot(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  requestAppointment() {
    // Marcar todos los campos como touched para mostrar errores
    Object.keys(this.requestForm.controls).forEach(key => {
      this.requestForm.get(key)?.markAsTouched();
    });

    if (this.requestForm.invalid) {
      // Mostrar errores específicos
      const errors: string[] = [];
      if (this.requestForm.get('professional_id')?.hasError('required')) {
        errors.push('El profesional es requerido');
      }
      if (this.requestForm.get('start_time')?.hasError('required') || !this.selectedSlot) {
        errors.push('Debe seleccionar un horario disponible');
      }
      if (this.requestForm.get('treatment_type')?.hasError('required')) {
        errors.push('El tipo de tratamiento es requerido');
      }
      
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error de Validación';
      this.modalMessage = errors.length > 0 ? errors.join('\n') : 'Por favor, complete todos los campos obligatorios.';
      this.modalCallback = null;
      return;
    }

    const formValue = this.requestForm.getRawValue();
    
    // Validar que los valores no estén vacíos
    if (!formValue.professional_id || formValue.professional_id === '') {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Por favor, seleccione un profesional.';
      this.modalCallback = null;
      return;
    }

    if (!formValue.start_time || formValue.start_time === '') {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Por favor, seleccione una fecha y hora.';
      this.modalCallback = null;
      return;
    }

    if (!formValue.treatment_type || formValue.treatment_type === '') {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Por favor, seleccione un tipo de tratamiento.';
      this.modalCallback = null;
      return;
    }

    this.requesting = true;
    
    // Obtener el perfil del paciente actual
    const user = this.auth.getCurrentUser();
    if (!user) {
      this.requesting = false;
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'No se pudo obtener la información del usuario.';
      this.modalCallback = null;
      return;
    }
    
    // Buscar el perfil del paciente
    this.api.getPatients().subscribe({
      next: (patients) => {
        const patientProfile = patients.find(p => p.user.id === user.id);
        if (!patientProfile) {
          this.requesting = false;
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = 'No se encontró su perfil de paciente.';
          this.modalCallback = null;
          return;
        }
        
        // Usar el slot seleccionado directamente si está disponible, para evitar problemas de zona horaria
        let startTime: Date;
        if (this.selectedSlot && this.selectedSlot.start) {
          // Usar la fecha/hora del slot seleccionado directamente
          startTime = new Date(this.selectedSlot.start);
        } else if (formValue.start_time) {
          // Si no hay slot seleccionado, usar el valor del formulario
          // El input datetime-local devuelve la fecha en hora local
          startTime = new Date(formValue.start_time);
        } else {
          this.requesting = false;
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = 'Por favor, seleccione un horario disponible.';
          this.modalCallback = null;
          return;
        }
        
        if (isNaN(startTime.getTime())) {
          this.requesting = false;
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = 'La fecha y hora seleccionadas no son válidas.';
          this.modalCallback = null;
          return;
        }
        
        // Validar que la fecha no sea en el pasado ni más de 3 meses en el futuro
        if (!this.isValidStartTime(startTime.toISOString())) {
          this.requesting = false;
          const now = new Date();
          const maxDate = new Date(now);
          maxDate.setMonth(maxDate.getMonth() + 3);
          
          let errorMsg = 'La fecha seleccionada no es válida.';
          if (startTime < now) {
            errorMsg = 'La fecha seleccionada no es válida.';
          } else if (startTime > maxDate) {
            errorMsg = 'La fecha seleccionada no es válida.';
          }
          
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = errorMsg;
          this.modalCallback = null;
          return;
        }

        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1);
        
        // Convertir professional_id a número
        const professionalId = typeof formValue.professional_id === 'string' 
          ? parseInt(formValue.professional_id, 10) 
          : formValue.professional_id;
        
        // Enviar la fecha/hora en formato ISO (UTC) al backend
        const payload: any = {
          patient_id: patientProfile.id,
          professional_id: professionalId,
          start_time: startTime.toISOString(),
          treatment_type: formValue.treatment_type,
          notes: formValue.notes || '',
        };
        
        // Verificar conflictos (necesitamos end_time para la verificación)
        this.checkAppointmentConflict({
          ...payload,
          end_time: endTime.toISOString(),
        }, () => {
          this.api.createAppointment(payload).subscribe({
          next: (createdAppointment) => {
            console.log('Cita solicitada:', createdAppointment);
            this.requestForm.reset();
            this.requesting = false;
            // Cambiar a la pestaña "Mis citas" para pacientes
            if (this.isPatient()) {
              this.activeTab = 'my-appointments';
            } else {
              this.activeTab = 'calendar';
            }
            
            // Llamar directamente a refresh() que ya tiene toda la lógica
            setTimeout(() => {
              this.refresh();
              this.showModal = true;
              this.modalType = 'success';
              this.modalTitle = 'Éxito';
              this.modalMessage = 'Cita solicitada correctamente. Será revisada por el personal.';
              this.modalCallback = null;
            }, 500); // Esperar 500ms antes de refrescar
          },
          error: (err) => {
            console.error('Error al solicitar cita:', err);
            this.requesting = false;
            let errorMessage = 'Error al solicitar la cita.';
            if (err.error && err.error.detail) {
              errorMessage = err.error.detail;
            } else if (err.error && typeof err.error === 'object') {
              const errorKeys = Object.keys(err.error);
              if (errorKeys.length > 0) {
                const firstError = err.error[errorKeys[0]];
                if (Array.isArray(firstError)) {
                  errorMessage = firstError[0];
                } else if (typeof firstError === 'string') {
                  errorMessage = firstError;
                }
              }
            }
            this.showModal = true;
            this.modalType = 'error';
            this.modalTitle = 'Error';
            this.modalMessage = errorMessage;
            this.modalCallback = null;
          }
        });
        });
      },
      error: () => {
        this.requesting = false;
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = 'Error al cargar los datos.';
        this.modalCallback = null;
      }
    });
  }

  closeModal() {
    this.showModal = false;
    this.modalTitle = '';
    this.modalMessage = '';
    this.modalCallback = null;
  }

  confirmModal() {
    if (this.modalCallback) {
      this.modalCallback();
    }
    this.closeModal();
  }

  toggleTreatmentTypeDropdown() {
    this.showTreatmentTypeDropdown = !this.showTreatmentTypeDropdown;
  }

  selectTreatmentType(serviceName: string) {
    this.requestForm.patchValue({ treatment_type: serviceName });
    this.showTreatmentTypeDropdown = false;
  }

  toggleTreatmentTypeDropdownForForm() {
    this.showTreatmentTypeDropdownForForm = !this.showTreatmentTypeDropdownForForm;
  }

  selectTreatmentTypeForForm(serviceName: string) {
    this.form.patchValue({ treatment_type: serviceName });
    this.form.get('treatment_type')?.markAsTouched();
    this.form.get('treatment_type')?.updateValueAndValidity();
    this.showTreatmentTypeDropdownForForm = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.equipment-dropdown-container')) {
      this.showTreatmentTypeDropdown = false;
      this.showTreatmentTypeDropdownForForm = false;
      this.showTreatmentTypeDropdownForEdit = false;
    }
  }
}
