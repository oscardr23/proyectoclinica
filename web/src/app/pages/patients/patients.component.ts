import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';

import { PatientProfile, Budget } from '../../core/models';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'dc-patients',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="section" *ngIf="!selectedPatient && !showNewPatientForm">
      <div class="section-header">
        <h2>Pacientes</h2>
        <button class="btn btn-primary" (click)="showNewPatientForm = true">+ Nuevo Paciente</button>
      </div>

      <div class="search-bar">
        <input type="text" placeholder="Buscar paciente..." [(ngModel)]="searchTerm" />
      </div>

      <div class="patients-grid">
        <div
          *ngFor="let patient of filteredPatients"
          class="patient-card"
          (click)="selectPatient(patient)"
        >
          <h3>{{ patient.user.first_name }} {{ patient.user.last_name }}</h3>
          <p>{{ patient.user.email }}</p>
          <p>Tel: {{ patient.user.phone || '—' }}</p>
          <p *ngIf="patient.allergies">Alergias: {{ patient.allergies }}</p>
        </div>
      </div>
    </div>

    <!-- Formulario de nuevo paciente -->
    <div *ngIf="showNewPatientForm" class="section">
      <div class="section-header">
        <h2>Nuevo Paciente</h2>
      </div>
      
      <form (ngSubmit)="createPatient()" class="form-section">
        <div class="form-grid">
          <div class="form-group">
            <label>Nombre *</label>
            <input type="text" [(ngModel)]="newPatient.first_name" name="first_name" required />
          </div>
          <div class="form-group">
            <label>Apellidos *</label>
            <input type="text" [(ngModel)]="newPatient.last_name" name="last_name" required />
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" [(ngModel)]="newPatient.email" name="email" required />
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input type="tel" [(ngModel)]="newPatient.phone" name="phone" (keypress)="onPhoneKeyPress($event)" maxlength="9" placeholder="Solo números (9 dígitos)" />
            <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem;">Solo se permiten números</small>
          </div>
          <div class="form-group">
            <label>DNI/NIE *</label>
            <input type="text" [(ngModel)]="newPatient.document_id" name="document_id" required (blur)="validateDNI()" placeholder="12345678A o X1234567L" maxlength="9" />
            <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem;">Formato: 8 números + 1 letra (DNI) o X/Y/Z + 7 números + letra (NIE)</small>
            <small *ngIf="dniError" style="color: #f44336; font-size: 0.85rem; margin-top: 0.25rem; display: block;">{{ dniError }}</small>
          </div>
          <div class="form-group">
            <label>Fecha de Nacimiento</label>
            <input type="date" [(ngModel)]="newPatient.date_of_birth" name="date_of_birth" [min]="getMinBirthDate()" [max]="getMaxBirthDate()" />
            <small *ngIf="newPatient.date_of_birth && !isValidBirthDate()" style="color: #f44336; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
              {{ getBirthDateErrorMessage() }}
            </small>
            <small *ngIf="!newPatient.date_of_birth || isValidBirthDate()" style="color: #666; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
              La fecha debe será validada.
            </small>
          </div>
          <div class="form-group full-width">
            <label>Alergias/Notas</label>
            <textarea [(ngModel)]="newPatient.allergies" name="allergies" rows="4"></textarea>
          </div>
        </div>
        <div style="text-align: right; margin-top: 1rem;">
          <button type="button" class="btn btn-secondary" (click)="showNewPatientForm = false" style="margin-right: 0.5rem;">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="creating">Guardar</button>
        </div>
      </form>
    </div>

    <div *ngIf="selectedPatient" class="patient-detail">
      <div class="patient-header">
        <div class="patient-info">
          <h2>{{ selectedPatient.user.first_name }} {{ selectedPatient.user.last_name }}</h2>
          <div class="details">
            <div class="detail-item">
              <strong>DNI:</strong> {{ selectedPatient.user.document_id || '—' }}
            </div>
            <div class="detail-item">
              <strong>Teléfono:</strong> {{ selectedPatient.user.phone || '—' }}
            </div>
            <div class="detail-item">
              <strong>Email:</strong> {{ selectedPatient.user.email }}
            </div>
            <div class="detail-item">
              <strong>Fecha Nacimiento:</strong> {{ selectedPatient.date_of_birth | date: 'dd/MM/yyyy' }}
            </div>
          </div>
        </div>
      </div>

      <div class="tabs">
        <div class="tab-buttons">
          <button class="tab-button" [class.active]="activeTab === 'data'" (click)="activeTab = 'data'">Datos Personales</button>
          <button class="tab-button" [class.active]="activeTab === 'history'" (click)="activeTab = 'history'">Historial Clínico</button>
          <button class="tab-button" [class.active]="activeTab === 'budgets'" (click)="activeTab = 'budgets'">Presupuestos</button>
        </div>

        <div class="tab-content">
          <!-- Advertencia de bloqueo -->
          <div *ngIf="isLockedByOther && selectedPatient" class="lock-warning" style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 5px; padding: 1rem; margin-bottom: 1rem; color: #856404;">
            <strong>⚠️ Advertencia:</strong> El paciente está siendo editado por <strong>{{ lockedByUser }}</strong>. Los cambios no se guardarán hasta que termine.
          </div>
          
          <div *ngIf="activeTab === 'data'" class="form-section">
            <div class="form-grid">
              <div class="form-group">
                <label>Nombre</label>
                <input type="text" [(ngModel)]="selectedPatient.user.first_name" />
              </div>
              <div class="form-group">
                <label>Apellidos</label>
                <input type="text" [(ngModel)]="selectedPatient.user.last_name" />
              </div>
              <div class="form-group">
                <label>DNI/NIE</label>
                <input type="text" [(ngModel)]="selectedPatient.user.document_id" />
              </div>
              <div class="form-group">
                <label>Fecha de Nacimiento</label>
                <input type="date" [value]="selectedPatient.date_of_birth || ''" readonly />
              </div>
              <div class="form-group">
                <label>Teléfono</label>
                <input type="tel" [(ngModel)]="selectedPatient.user.phone" />
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" [(ngModel)]="selectedPatient.user.email" />
              </div>
              <div class="form-group full-width">
                <label>Alergias/Notas</label>
                <textarea [(ngModel)]="selectedPatient.allergies" rows="4"></textarea>
              </div>
            </div>
            <div style="text-align: right; margin-top: 1rem;">
              <button class="btn btn-secondary" (click)="goBackToList()" style="margin-right: 0.5rem;">Volver</button>
              <button *ngIf="isAdmin()" class="btn btn-danger" (click)="confirmDeletePatient()" style="margin-right: 0.5rem;">Eliminar Paciente</button>
              <button class="btn btn-primary" (click)="savePatient()" [disabled]="isLockedByOther">Guardar Cambios</button>
            </div>
          </div>

          <div *ngIf="activeTab === 'history'">
            <h3 style="color: #667eea; margin-bottom: 1.5rem;">Historial Clínico</h3>
            <div *ngIf="patientHistory.length === 0" class="empty-state">
              <p>No hay historial clínico registrado</p>
            </div>
            <div *ngFor="let entry of patientHistory" class="history-item">
              <h4>{{ entry.treatment }}</h4>
              <div class="date">{{ entry.date | date: 'dd/MM/yyyy' }} - {{ entry.professional }}</div>
              <div class="description">{{ entry.description }}</div>
            </div>
          </div>

          <div *ngIf="activeTab === 'budgets'">
            <h3 style="color: #667eea; margin-bottom: 1.5rem;">Presupuestos</h3>
            <div *ngIf="patientBudgets.length === 0" class="empty-state">
              <p>No hay presupuestos registrados</p>
            </div>
            <div *ngFor="let budget of patientBudgets" class="presupuesto-item">
              <div class="presupuesto-info">
                <h4>{{ budget.description }}</h4>
                <div class="date">Fecha: {{ budget.created_at | date: 'dd/MM/yyyy' }}</div>
                <span class="status-badge" [ngClass]="'status-' + budget.status.toLowerCase()">
                  {{ getBudgetStatusLabel(budget.status) }}
                </span>
              </div>
              <div class="presupuesto-amount">{{ budget.estimated_cost | currency: 'EUR' }}</div>
            </div>
          </div>
        </div>
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
          <button *ngIf="modalType === 'confirm'" class="btn btn-secondary" (click)="handleNoClick()">No</button>
          <button *ngIf="modalType === 'confirm'" class="btn btn-primary" (click)="handleYesClick()">Sí</button>
          <button *ngIf="modalType !== 'confirm'" class="btn btn-primary" (click)="closeModal()">Aceptar</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
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

      .btn {
        padding: 0.6rem 1.2rem;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.3s;
        text-decoration: none;
        display: inline-block;
      }

      .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .btn-secondary {
        background-color: #e0e0e0;
        color: #333;
        margin-left: 0.5rem;
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
      }

      .patients-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1rem;
      }

      .patient-card {
        border: 2px solid #f0f0f0;
        border-radius: 10px;
        padding: 1.5rem;
        background-color: #fafafa;
        transition: all 0.3s;
        cursor: pointer;
      }

      .patient-card:hover {
        border-color: #667eea;
        background-color: white;
        transform: translateY(-3px);
        box-shadow: 0 4px 10px rgba(102, 126, 234, 0.2);
      }

      .patient-card h3 {
        color: #667eea;
        margin-bottom: 0.5rem;
      }

      .patient-header {
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        padding: 2rem;
        margin-bottom: 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .patient-info h2 {
        color: #667eea;
        font-size: 2rem;
        margin-bottom: 0.5rem;
      }

      .details {
        display: flex;
        gap: 2rem;
        margin-top: 1rem;
        color: #666;
        flex-wrap: wrap;
      }

      .detail-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .tabs {
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        margin-bottom: 2rem;
        overflow: hidden;
      }

      .tab-buttons {
        display: flex;
        border-bottom: 2px solid #f0f0f0;
      }

      .tab-button {
        flex: 1;
        padding: 1rem 2rem;
        background: none;
        border: none;
        cursor: pointer;
        font-weight: 500;
        color: #666;
        transition: all 0.3s;
        border-bottom: 3px solid transparent;
      }

      .tab-button.active {
        color: #667eea;
        border-bottom-color: #667eea;
        background-color: #f0f4ff;
      }

      .tab-content {
        padding: 2rem;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.5rem;
        margin-bottom: 1.5rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;
      }

      .form-group.full-width {
        grid-column: 1 / -1;
      }

      label {
        margin-bottom: 0.5rem;
        color: #333;
        font-weight: 500;
      }

      input,
      textarea {
        padding: 0.8rem;
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        font-size: 1rem;
        transition: border-color 0.3s;
      }

      input[readonly],
      input:read-only {
        background-color: #f5f5f5;
        color: #666;
        cursor: not-allowed;
      }

      input:focus,
      textarea:focus {
        outline: none;
        border-color: #667eea;
      }

      input[readonly]:focus,
      input:read-only:focus {
        border-color: #e0e0e0;
      }

      textarea {
        resize: vertical;
        min-height: 100px;
      }

      .history-item {
        padding: 1.5rem;
        border-left: 4px solid #667eea;
        background-color: #fafafa;
        margin-bottom: 1rem;
        border-radius: 5px;
      }

      .history-item h4 {
        color: #667eea;
        margin-bottom: 0.5rem;
      }

      .history-item .date {
        color: #666;
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
      }

      .history-item .description {
        color: #333;
        line-height: 1.6;
      }

      .presupuesto-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background-color: #fafafa;
        margin-bottom: 1rem;
        border-radius: 5px;
        border-left: 4px solid #4CAF50;
      }

      .presupuesto-info h4 {
        color: #333;
        margin-bottom: 0.3rem;
      }

      .presupuesto-info .date {
        color: #666;
        font-size: 0.9rem;
      }

      .presupuesto-amount {
        font-size: 1.3rem;
        font-weight: 600;
        color: #4CAF50;
      }

      .status-badge {
        display: inline-block;
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 500;
        margin-top: 0.5rem;
      }

      .status-accepted {
        background-color: #4CAF50;
        color: white;
      }

      .status-pending {
        background-color: #ff9800;
        color: white;
      }

      .status-rejected {
        background-color: #f44336;
        color: white;
      }

      .document-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background-color: #fafafa;
        margin-bottom: 1rem;
        border-radius: 5px;
        border-left: 4px solid #667eea;
      }

      .document-info h4 {
        color: #667eea;
        margin-bottom: 0.3rem;
      }

      .document-info .date {
        color: #666;
        font-size: 0.9rem;
        margin-bottom: 0.3rem;
      }

      .document-info .description {
        color: #333;
        font-size: 0.9rem;
      }

      .document-actions {
        display: flex;
        gap: 0.5rem;
      }

      .empty-state {
        text-align: center;
        padding: 2rem;
        color: #999;
      }

      .btn-danger {
        background-color: #f44336;
        color: white;
      }

      .btn-danger:hover {
        background-color: #d32f2f;
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
    `,
  ],
})
export class PatientsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  
  patients: PatientProfile[] = [];
  selectedPatient: PatientProfile | null = null;
  originalPatientData: { 
    first_name?: string; 
    last_name?: string; 
    document_id?: string; 
    phone?: string; 
    email?: string; 
    allergies?: string;
    updated_at?: string;
  } | null = null;
  activeTab = 'data';
  searchTerm = '';
  showNewAppointment = false;
  showNewPatientForm = false;
  creating = false;
  patientHistory: any[] = [];
  patientBudgets: Budget[] = [];
  
  // Control de concurrencia
  lockStatus: any = null;
  lockCheckInterval: Subscription | null = null;
  isLockedByOther = false;
  lockedByUser: string | null = null;
  
  // Modal states
  showModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'info' | 'confirm' | 'success' | 'error' = 'info';
  modalCallback: (() => void) | null = null;
  
  newPatient: any = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    document_id: '',
    date_of_birth: '',
    allergies: '',
  };
  dniError = '';

  ngOnInit() {
    this.api.getPatients().subscribe((patients) => (this.patients = patients));
  }

  ngOnDestroy() {
    // Limpiar suscripciones y desbloquear al salir
    if (this.lockCheckInterval) {
      this.lockCheckInterval.unsubscribe();
    }
    if (this.selectedPatient) {
      this.unlockPatient();
    }
  }

  get filteredPatients(): PatientProfile[] {
    if (!this.searchTerm) return this.patients;
    const term = this.searchTerm.toLowerCase();
    return this.patients.filter(p =>
      `${p.user.first_name} ${p.user.last_name}`.toLowerCase().includes(term) ||
      p.user.email.toLowerCase().includes(term)
    );
  }

  selectPatient(patient: PatientProfile) {
    // Desbloquear paciente anterior si existe
    if (this.selectedPatient) {
      this.unlockPatient();
    }
    
    // Crear una copia profunda del paciente para evitar modificar el original directamente
    this.selectedPatient = JSON.parse(JSON.stringify(patient));
    this.activeTab = 'data';
    // Guardar los valores originales para detectar cambios, incluyendo updated_at
    this.originalPatientData = {
      first_name: patient.user.first_name || '',
      last_name: patient.user.last_name || '',
      document_id: patient.user.document_id || '',
      phone: patient.user.phone || '',
      email: patient.user.email || '',
      allergies: patient.allergies || '',
      updated_at: patient.updated_at || '',
    };
    
    // Bloquear el paciente para edición
    this.lockPatient(patient.id);
    
    // Cargar historial y presupuestos del paciente
    this.loadPatientData(patient.id);
    
    // Iniciar verificación periódica del estado del bloqueo
    this.startLockStatusCheck(patient.id);
  }

  loadPatientData(patientId: number) {
    // Cargar historial clínico
    this.api.getClinicalRecords(patientId).subscribe({
      next: (records) => {
        this.patientHistory = records.map(record => ({
          treatment: record.treatment,
          date: record.created_at,
          professional: record.professional_name || 'Sin asignar',
          description: record.notes || record.diagnosis || '',
        }));
      },
      error: (error) => {
        console.error('Error al cargar historial:', error);
        this.patientHistory = [];
      },
    });

    // Cargar presupuestos
    this.api.getBudgets(patientId).subscribe({
      next: (budgets) => {
        this.patientBudgets = budgets;
      },
      error: (error) => {
        console.error('Error al cargar presupuestos:', error);
        this.patientBudgets = [];
      },
    });

  }

  onPhoneKeyPress(event: KeyboardEvent) {
    const char = String.fromCharCode(event.which || event.keyCode);
    if (!/[0-9]/.test(char)) {
      event.preventDefault();
    }
  }

  getMinBirthDate(): string {
    return '1900-01-01';
  }

  getMaxBirthDate(): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split('T')[0];
  }

  isValidBirthDate(): boolean {
    if (!this.newPatient.date_of_birth) {
      return true; // Si no hay fecha, es válido (campo opcional)
    }
    
    const birthDate = new Date(this.newPatient.date_of_birth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDate = new Date('1900-01-01');
    
    return birthDate >= minDate && birthDate <= today;
  }

  getBirthDateErrorMessage(): string {
    if (!this.newPatient.date_of_birth) {
      return '';
    }
    
    const birthDate = new Date(this.newPatient.date_of_birth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDate = new Date('1900-01-01');
    
    if (birthDate < minDate) {
      return 'La fecha de nacimiento es incorrecta';
    }
    if (birthDate > today) {
      return 'La fecha de nacimiento es incorrecta';
    }
    
    return '';
  }

  validateDNI() {
    const dni = this.newPatient.document_id?.trim().toUpperCase() || '';
    this.dniError = '';
    
    if (!dni) {
      return;
    }
    
    // Validar formato DNI: 8 números + 1 letra
    const dniPattern = /^[0-9]{8}[A-Z]$/;
    // Validar formato NIE: X/Y/Z + 7 números + 1 letra
    const niePattern = /^[XYZ][0-9]{7}[A-Z]$/;
    
    if (!dniPattern.test(dni) && !niePattern.test(dni)) {
      this.dniError = 'Formato inválido. Use: 12345678A (DNI) o X1234567L (NIE)';
      return;
    }
    
    // Validar letra del DNI
    if (dniPattern.test(dni)) {
      const numbers = dni.substring(0, 8);
      const letter = dni.substring(8);
      const validLetters = 'TRWAGMYFPDXBNJZSQVHLCKE';
      const expectedLetter = validLetters[parseInt(numbers) % 23];
      if (letter !== expectedLetter) {
        this.dniError = 'La letra del DNI no es correcta';
        return;
      }
    }
  }

  createPatient() {
    if (!this.newPatient.first_name || !this.newPatient.last_name || !this.newPatient.email) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Por favor, complete los campos obligatorios (Nombre, Apellidos, Email)';
      this.modalCallback = null;
      return;
    }

    if (this.newPatient.document_id && this.dniError) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Por favor, corrija el DNI/NIE antes de continuar';
      this.modalCallback = null;
      return;
    }

    // Validar DNI si está presente
    if (this.newPatient.document_id) {
      this.validateDNI();
      if (this.dniError) {
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = 'Por favor, corrija el DNI/NIE antes de continuar';
        this.modalCallback = null;
        return;
      }
    }

    // Validar fecha de nacimiento
    if (this.newPatient.date_of_birth && !this.isValidBirthDate()) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = this.getBirthDateErrorMessage();
      this.modalCallback = null;
      return;
    }

    this.creating = true;
    
    // Crear el paciente con usuario nuevo
    const patientData = {
      first_name: this.newPatient.first_name,
      last_name: this.newPatient.last_name,
      email: this.newPatient.email,
      phone: this.newPatient.phone || '',
      document_id: this.newPatient.document_id || '',
      date_of_birth: this.newPatient.date_of_birth || null,
      allergies: this.newPatient.allergies || '',
    };
    
    this.api.createPatient(patientData).subscribe({
      next: () => {
        this.creating = false;
        this.showNewPatientForm = false;
        this.resetNewPatientForm();
        // Recargar lista de pacientes
        this.ngOnInit();
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = 'Paciente creado correctamente.';
        this.modalCallback = null;
      },
      error: (error) => {
        this.creating = false;
        console.error('Error al crear paciente:', error);
        let errorMsg = 'Error al crear el paciente. Por favor, intente nuevamente.';
        if (error?.error?.document_id) {
          errorMsg = error.error.document_id[0] || 'Ya existe un paciente con este DNI/NIE';
        } else if (error?.error?.email) {
          errorMsg = error.error.email[0] || 'Ya existe un usuario con este email';
        } else if (error?.error?.detail) {
          errorMsg = error.error.detail;
        } else if (error?.error && typeof error.error === 'object') {
          const errorKeys = Object.keys(error.error);
          if (errorKeys.length > 0) {
            const firstError = error.error[errorKeys[0]];
            if (Array.isArray(firstError)) {
              errorMsg = firstError[0];
            } else if (typeof firstError === 'string') {
              errorMsg = firstError;
            }
          }
        }
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = errorMsg;
        this.modalCallback = null;
      },
    });
  }

  resetNewPatientForm() {
    this.newPatient = {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      document_id: '',
      date_of_birth: '',
      allergies: '',
    };
    this.dniError = '';
  }

  hasUnsavedChanges(): boolean {
    if (!this.selectedPatient || !this.originalPatientData) return false;
    
    const currentFirstName = this.selectedPatient.user.first_name || '';
    const currentLastName = this.selectedPatient.user.last_name || '';
    const currentDocumentId = this.selectedPatient.user.document_id || '';
    const currentPhone = this.selectedPatient.user.phone || '';
    const currentEmail = this.selectedPatient.user.email || '';
    const currentAllergies = this.selectedPatient.allergies || '';
    
    return (
      currentFirstName !== this.originalPatientData.first_name ||
      currentLastName !== this.originalPatientData.last_name ||
      currentDocumentId !== this.originalPatientData.document_id ||
      currentPhone !== this.originalPatientData.phone ||
      currentEmail !== this.originalPatientData.email ||
      currentAllergies !== this.originalPatientData.allergies
    );
  }

  goBackToList() {
    if (this.hasUnsavedChanges()) {
      // Mostrar modal de confirmación
      this.showModal = true;
      this.modalType = 'confirm';
      this.modalTitle = 'Cambios sin guardar';
      this.modalMessage = 'Algunos campos han sido modificados. ¿Desea guardar los cambios antes de volver?';
      // No necesitamos callback aquí, lo manejaremos en handleYesClick/handleNoClick
      this.modalCallback = null;
    } else {
      // No hay cambios, volver directamente
      this.unlockAndReturn();
    }
  }

  unlockAndReturn() {
    this.unlockPatient();
    this.selectedPatient = null;
    this.originalPatientData = null;
    this.activeTab = 'data';
    this.isLockedByOther = false;
    this.lockedByUser = null;
  }

  savePatientAndReturn() {
    if (!this.selectedPatient) return;
    
    // Verificar si está bloqueado por otro usuario
    if (this.isLockedByOther) {
      this.closeModal();
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = `El paciente está siendo editado por ${this.lockedByUser}. Por favor, espera a que termine.`;
      this.modalCallback = null;
      return;
    }
    
    const payload: any = {
      first_name: this.selectedPatient.user.first_name || '',
      last_name: this.selectedPatient.user.last_name || '',
      document_id: this.selectedPatient.user.document_id || '',
      phone: this.selectedPatient.user.phone || '',
      email: this.selectedPatient.user.email || '',
      allergies: this.selectedPatient.allergies || '',
      _updated_at: this.originalPatientData?.updated_at || this.selectedPatient.updated_at || '',
    };
    
    this.api.updatePatient(this.selectedPatient.id, payload).subscribe({
      next: (updated) => {
        // Actualizar en la lista
        const index = this.patients.findIndex(p => p.id === updated.id);
        if (index !== -1) {
          this.patients[index] = updated;
        }
        // Desbloquear y volver a la lista
        this.unlockAndReturn();
        // Cerrar el modal de confirmación
        this.closeModal();
        // Mostrar mensaje de éxito
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = 'Paciente actualizado correctamente.';
        this.modalCallback = null;
      },
      error: (err) => {
        console.error('Error al guardar paciente:', err);
        let errorMessage = 'Error al guardar los cambios.';
        
        // Manejar errores de concurrencia
        if (err.error?.error) {
          errorMessage = err.error.error;
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
        this.closeModal();
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = errorMessage;
        this.modalCallback = null;
      }
    });
  }

  savePatient() {
    if (!this.selectedPatient) return;
    
    // Verificar si está bloqueado por otro usuario
    if (this.isLockedByOther) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = `El paciente está siendo editado por ${this.lockedByUser}. Por favor, espera a que termine.`;
      this.modalCallback = null;
      return;
    }
    
    const payload: any = {
      first_name: this.selectedPatient.user.first_name || '',
      last_name: this.selectedPatient.user.last_name || '',
      document_id: this.selectedPatient.user.document_id || '',
      phone: this.selectedPatient.user.phone || '',
      email: this.selectedPatient.user.email || '',
      allergies: this.selectedPatient.allergies || '',
      _updated_at: this.originalPatientData?.updated_at || this.selectedPatient.updated_at || '',
    };
    
    this.api.updatePatient(this.selectedPatient.id, payload).subscribe({
      next: (updated) => {
        // Actualizar en la lista
        const index = this.patients.findIndex(p => p.id === updated.id);
        if (index !== -1) {
          this.patients[index] = updated;
        }
        // Desbloquear y volver a la lista automáticamente después de guardar
        this.unlockAndReturn();
        // Mostrar mensaje de éxito
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = 'Paciente actualizado correctamente.';
        this.modalCallback = null;
      },
      error: (err) => {
        console.error('Error al guardar paciente:', err);
        let errorMessage = 'Error al guardar los cambios.';
        
        // Manejar errores de concurrencia
        if (err.error?.error) {
          errorMessage = err.error.error;
          // Si es un error de concurrencia, recargar el paciente
          if (err.error.error.includes('modificado por otro usuario') || 
              err.error.error.includes('siendo editado')) {
            this.loadPatientData(this.selectedPatient!.id);
            this.api.getPatients().subscribe((patients) => {
              this.patients = patients;
              const updated = patients.find(p => p.id === this.selectedPatient!.id);
              if (updated) {
                this.selectPatient(updated);
              }
            });
          }
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
  }

  getBudgetStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'APPROVED': 'Aprobado',
      'DRAFT': 'Borrador',
      'REJECTED': 'Rechazado',
    };
    return labels[status] || status;
  }


  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  confirmDeletePatient() {
    if (!this.selectedPatient) return;
    this.showModal = true;
    this.modalType = 'confirm';
    this.modalTitle = 'Confirmar Eliminación';
    this.modalMessage = `¿Está seguro de que desea eliminar al paciente "${this.selectedPatient.user.first_name} ${this.selectedPatient.user.last_name}"?\n\nEsta acción no se puede deshacer.`;
    this.modalCallback = () => {
      this.deletePatient();
    };
  }

  deletePatient() {
    if (!this.selectedPatient) return;
    const patientId = this.selectedPatient.id;
    this.api.deletePatient(patientId).subscribe({
      next: () => {
        this.patients = this.patients.filter(p => p.id !== patientId);
        this.selectedPatient = null;
        this.closeModal();
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = 'Paciente eliminado correctamente.';
        this.modalCallback = null;
      },
      error: (err) => {
        console.error('Error al eliminar paciente:', err);
        let errorMessage = 'Error al eliminar el paciente.';
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
        this.closeModal();
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = errorMessage;
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

  handleYesClick() {
    // "Sí" - guardar cambios y volver
    if (this.modalType === 'confirm' && this.modalTitle === 'Cambios sin guardar') {
      // Guardar los cambios antes de volver
      this.closeModal();
      this.savePatientAndReturn();
    } else if (this.modalCallback) {
      // Para otros modales de confirmación (como eliminar)
      const callback = this.modalCallback;
      this.modalCallback = null;
      this.closeModal();
      callback();
    } else {
      this.closeModal();
    }
  }

  handleNoClick() {
    // "No" - descartar cambios y volver sin guardar
    if (this.modalType === 'confirm' && this.modalTitle === 'Cambios sin guardar') {
      // Cerrar modal y volver a la lista sin guardar cambios
      // Los cambios en selectedPatient se descartan automáticamente al volver a seleccionar
      this.closeModal();
      this.unlockAndReturn();
    } else {
      // Para otros modales, simplemente cancelar
      this.closeModal();
    }
  }

  confirmModal() {
    // Método legacy - usar handleYesClick en su lugar
    this.handleYesClick();
  }

  cancelModal() {
    // Método legacy - usar handleNoClick en su lugar
    this.handleNoClick();
  }

  // Métodos para control de concurrencia
  lockPatient(patientId: number) {
    this.api.lockPatient(patientId).subscribe({
      next: (response) => {
        this.lockStatus = response;
        this.isLockedByOther = false;
      },
      error: (err) => {
        console.error('Error al bloquear paciente:', err);
        if (err.status === 409) {
          // Conflicto: otro usuario ya está editando
          this.isLockedByOther = true;
          this.lockedByUser = err.error?.locked_by || 'Otro usuario';
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Paciente en edición';
          this.modalMessage = `El paciente está siendo editado por ${this.lockedByUser}. Por favor, espera a que termine.`;
          this.modalCallback = null;
        }
      }
    });
  }

  unlockPatient() {
    if (!this.selectedPatient) return;
    
    // Detener verificación periódica
    if (this.lockCheckInterval) {
      this.lockCheckInterval.unsubscribe();
      this.lockCheckInterval = null;
    }
    
    this.api.unlockPatient(this.selectedPatient.id).subscribe({
      next: () => {
        this.lockStatus = null;
        this.isLockedByOther = false;
        this.lockedByUser = null;
      },
      error: (err) => {
        console.error('Error al desbloquear paciente:', err);
      }
    });
  }

  startLockStatusCheck(patientId: number) {
    // Verificar el estado del bloqueo cada 5 segundos
    this.lockCheckInterval = interval(5000).subscribe(() => {
      this.checkLockStatus(patientId);
    });
  }

  checkLockStatus(patientId: number) {
    this.api.getPatientLockStatus(patientId).subscribe({
      next: (status) => {
        if (status.is_locked && !status.is_current_user) {
          // Otro usuario está editando
          this.isLockedByOther = true;
          this.lockedByUser = status.locked_by;
        } else {
          this.isLockedByOther = false;
          this.lockedByUser = null;
        }
        this.lockStatus = status;
      },
      error: (err) => {
        console.error('Error al verificar estado del bloqueo:', err);
      }
    });
  }
}
