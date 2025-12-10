import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, HostListener, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Equipment, Room } from '../../core/models';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'dc-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <h3>{{ rooms.length }}</h3>
        <p style="color: white;">Salas Totales</p>
      </div>
      <div class="stat-card">
        <h3>{{ availableRooms.length }}</h3>
        <p style="color: white;">Salas Disponibles</p>
      </div>
      <div class="stat-card">
        <h3>{{ totalEquipment }}</h3>
        <p style="color: white;">Equipos Disponibles</p>
      </div>
    </div>

      <!-- Formulario de edición/creación de sala -->
      <div *ngIf="showNewRoomForm || editingRoom" class="section">
        <div class="section-header">
          <h2>{{ editingRoom ? 'Editar Sala' : 'Nueva Sala' }}</h2>
        </div>
        <div class="form-section">
          <div class="form-grid">
            <div class="form-group">
              <label>Nombre *</label>
              <input type="text" [(ngModel)]="(editingRoom || newRoom).name" required />
            </div>
            <div class="form-group">
              <label>Estado *</label>
              <select [(ngModel)]="(editingRoom || newRoom).status">
                <option value="AVAILABLE">Disponible</option>
                <option value="MAINTENANCE">Mantenimiento</option>
              </select>
              <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem;">Seleccione el estado actual de la sala</small>
            </div>
            <div class="form-group full-width">
              <label>Descripción</label>
              <textarea [(ngModel)]="(editingRoom || newRoom).description" rows="3"></textarea>
            </div>
            <div class="form-group full-width">
              <label>Equipamiento</label>
              <div class="equipment-dropdown-container">
                <div class="equipment-dropdown" (click)="toggleEquipmentDropdown()">
                  <span *ngIf="getSelectedEquipmentNames().length === 0" class="dropdown-placeholder">
                    Seleccione equipamiento
                  </span>
                  <span *ngIf="getSelectedEquipmentNames().length > 0" class="dropdown-selected">
                    {{ getSelectedEquipmentNames() }}
                  </span>
                  <span class="dropdown-arrow">▼</span>
                </div>
                <div *ngIf="showEquipmentDropdown" class="equipment-dropdown-menu">
                  <div *ngFor="let eq of equipment" 
                       class="equipment-dropdown-item" 
                       [class.selected]="isEquipmentSelected(eq.id)"
                       (click)="toggleEquipment(eq.id)">
                    <span>{{ eq.name }}</span>
                  </div>
                  <div *ngIf="equipment.length === 0" class="no-equipment">
                    <p>No hay equipamiento disponible</p>
                  </div>
                </div>
              </div>
              <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                Seleccione uno o varios equipamientos para esta sala
              </small>
            </div>
          </div>
          <div style="text-align: right; margin-top: 1rem;">
            <button type="button" class="btn btn-danger" (click)="confirmDeleteRoom(editingRoom!)" *ngIf="editingRoom" style="margin-right: 0.5rem;">Eliminar</button>
            <button type="button" class="btn btn-secondary" (click)="showNewRoomForm = false; editingRoom = null" style="margin-right: 0.5rem;">Cancelar</button>
            <button type="button" class="btn btn-primary" (click)="editingRoom ? saveRoom() : createRoom()">Guardar</button>
          </div>
        </div>
      </div>

      <div class="section">
      <div class="section-header">
        <h2>Gestión de Salas</h2>
        <button class="btn btn-primary" (click)="showNewRoomForm = true; editingRoom = null">+ Nueva Sala</button>
      </div>

      <div class="search-bar">
        <input type="text" placeholder="Buscar sala o equipo..." [(ngModel)]="searchTerm" />
      </div>

      <div class="filter-buttons">
        <button class="filter-btn" [class.active]="filterStatus === 'all'" (click)="filterStatus = 'all'">Todas</button>
        <button class="filter-btn" [class.active]="filterStatus === 'available'" (click)="filterStatus = 'available'">Disponibles</button>
        <button class="filter-btn" [class.active]="filterStatus === 'maintenance'" (click)="filterStatus = 'maintenance'">Mantenimiento</button>
      </div>

      <div class="grid">
        <div *ngFor="let room of filteredRooms" class="card" [class.maintenance]="room.status === 'MAINTENANCE'">
          <div class="card-header">
            <h3>{{ room.name }}</h3>
            <span class="status-badge" [ngClass]="getRoomStatusClass(room)">
              {{ getRoomStatus(room) }}
            </span>
          </div>
          <div class="card-info">
            <div class="info-item">
              <span class="info-label">Descripción:&nbsp;</span>
              <span>{{ room.description || 'Sin descripción' }}</span>
            </div>
            <div class="info-item" *ngIf="room.equipment && room.equipment.length > 0">
              <span class="info-label">Equipamiento:&nbsp;</span>
              <span>{{ getEquipmentNames(room.equipment) }}</span>
            </div>
          </div>
          <div class="equipment-list" *ngIf="room.equipment && room.equipment.length > 0">
            <span *ngFor="let eq of room.equipment" class="equipment-item">{{ eq.name }}</span>
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary" (click)="editRoom(room)" style="margin-right: 0.5rem;">Editar</button>
            <button class="btn btn-danger" (click)="confirmDeleteRoom(room)">Eliminar</button>
          </div>
        </div>
      </div>
    </div>

      <!-- Formulario de edición/creación de equipo -->
      <div *ngIf="showNewEquipmentForm || editingEquipment" class="section">
        <div class="section-header">
          <h2>{{ editingEquipment ? 'Editar Equipo' : 'Nuevo Equipo' }}</h2>
        </div>
        <div class="form-section">
          <div class="form-grid">
            <div class="form-group">
              <label>Nombre *</label>
              <input type="text" [(ngModel)]="(editingEquipment || newEquipment).name" required />
            </div>
            <div class="form-group">
              <label>Sala</label>
              <select [ngModel]="getCurrentEquipmentRoom()" (ngModelChange)="setCurrentEquipmentRoom($event)">
                <option [value]="null">Sin asignar</option>
                <option *ngFor="let room of rooms" [value]="room.id">{{ room.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Estado</label>
              <select [(ngModel)]="(editingEquipment || newEquipment).status">
                <option value="AVAILABLE">Disponible</option>
                <option value="MAINTENANCE">Mantenimiento</option>
                <option value="OUT_OF_SERVICE">Fuera de servicio</option>
              </select>
            </div>
            <div class="form-group">
              <label>Número de Serie</label>
              <input type="text" [(ngModel)]="(editingEquipment || newEquipment).serial_number" (input)="validateSerialNumber()" (blur)="validateSerialNumber()" placeholder="Ej: ABC-123456" maxlength="15" />
              <small *ngIf="serialNumberError" style="color: #f44336; font-size: 0.85rem; margin-top: 0.25rem; display: block;">{{ serialNumberError }}</small>
              <small *ngIf="!serialNumberError && (editingEquipment || newEquipment).serial_number" style="color: #4CAF50; font-size: 0.85rem; margin-top: 0.25rem; display: block;">✓ Formato válido</small>
              <small *ngIf="!serialNumberError && !(editingEquipment || newEquipment).serial_number" style="color: #666; font-size: 0.85rem; margin-top: 0.25rem; display: block;">Formato: 2-4 letras, guion opcional, 3-8 números (ej: ABC-123456 o ABC123456)</small>
            </div>
            <div class="form-group full-width">
              <label>Descripción</label>
              <textarea [(ngModel)]="(editingEquipment || newEquipment).description" rows="3"></textarea>
            </div>
          </div>
          <div style="text-align: right; margin-top: 1rem;">
            <button type="button" class="btn btn-danger" (click)="deleteEquipment()" *ngIf="editingEquipment" style="margin-right: 0.5rem;">Eliminar</button>
            <button type="button" class="btn btn-secondary" (click)="showNewEquipmentForm = false; editingEquipment = null" style="margin-right: 0.5rem;">Cancelar</button>
            <button type="button" class="btn btn-primary" (click)="editingEquipment ? saveEquipment() : createEquipment()">Guardar</button>
          </div>
        </div>
      </div>

      <div class="section">
      <div class="section-header">
        <h2>Gestión de Equipamiento</h2>
        <button class="btn btn-primary" (click)="showNewEquipmentForm = true; editingEquipment = null">+ Nuevo Equipo</button>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Sala Asignada</th>
            <th>Estado</th>
            <th>Última Revisión</th>
            <th>Próxima Revisión</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let eq of equipmentList">
            <td>{{ eq.name }}</td>
            <td>{{ eq.room }}</td>
            <td>
              <span class="status-badge" [ngClass]="'status-' + eq.status.toLowerCase().replace(' ', '-')">
                {{ eq.status }}
              </span>
            </td>
            <td>{{ eq.lastReview }}</td>
            <td>{{ eq.nextReview }}</td>
            <td>
              <button class="btn btn-secondary" style="padding: 0.3rem 0.8rem; font-size: 0.85rem;" (click)="editEquipmentById(eq.id)">Editar</button>
            </td>
          </tr>
        </tbody>
      </table>
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
      }

      .btn-success {
        background-color: #4CAF50;
        color: white;
      }

      .btn-danger {
        background-color: #f44336;
        color: white;
      }

      .btn-danger:hover {
        background-color: #d32f2f;
      }

      .search-bar {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .search-bar input {
        flex: 1;
        padding: 0.8rem;
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        font-size: 1rem;
      }

      .filter-buttons {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
      }

      .filter-btn {
        padding: 0.5rem 1rem;
        border: 2px solid #e0e0e0;
        background: white;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.3s;
        font-size: 0.9rem;
      }

      .filter-btn.active {
        background: #667eea;
        color: white;
        border-color: #667eea;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
      }

      .card {
        border: 2px solid #f0f0f0;
        border-radius: 10px;
        padding: 1.5rem;
        background-color: #fafafa;
        transition: all 0.3s;
        position: relative;
      }

      .card:hover {
        border-color: #667eea;
        background-color: white;
        transform: translateY(-5px);
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .card-header h3 {
        color: #667eea;
        font-size: 1.2rem;
      }

      .status-badge {
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
      }

      .status-available {
        background-color: #e8f5e9;
        color: #4CAF50;
      }

      .status-maintenance {
        background-color: #fff3e0;
        color: #ff9800;
      }

      .card-info {
        margin-bottom: 1rem;
      }

      .info-item {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f0f0f0;
        color: #666;
        font-size: 0.9rem;
      }

      .info-item:last-child {
        border-bottom: none;
      }

      .info-label {
        font-weight: 500;
        color: #333;
      }

      .equipment-list {
        margin-top: 0.5rem;
      }

      .equipment-item {
        display: inline-block;
        background-color: #e3f2fd;
        color: #1976d2;
        padding: 0.2rem 0.6rem;
        border-radius: 15px;
        font-size: 0.75rem;
        margin-right: 0.5rem;
        margin-top: 0.3rem;
      }

      .card-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #f0f0f0;
      }

      .card-actions .btn {
        flex: 1;
        text-align: center;
        padding: 0.5rem;
        font-size: 0.85rem;
      }

      .table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
      }

      .table th {
        background-color: #f0f4ff;
        color: #667eea;
        padding: 1rem;
        text-align: left;
        font-weight: 600;
        border-bottom: 2px solid #667eea;
      }

      .table td {
        padding: 1rem;
        border-bottom: 1px solid #f0f0f0;
      }

      .table tr:hover {
        background-color: #fafafa;
      }

      .form-section {
        padding: 1rem 0;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
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

      .checkbox-group {
        display: flex;
        align-items: center;
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        margin: 0;
      }

      .checkbox-label input[type="checkbox"] {
        width: auto;
        margin: 0;
        cursor: pointer;
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
export class ServicesComponent implements OnInit, AfterViewInit {
  private readonly api = inject(ApiService);
  
  rooms: Room[] = [];
  equipment: Equipment[] = [];
  searchTerm = '';
  filterStatus = 'all';
  equipmentList: any[] = [];
  showNewRoomForm = false;
  showNewEquipmentForm = false;
  showEquipmentDropdown = false;
  editingRoom: Room | null = null;
  editingEquipment: Equipment | null = null;
  newRoom = { name: '', description: '', equipment_ids: [] as number[], status: 'AVAILABLE' as 'AVAILABLE' | 'MAINTENANCE' };
  newEquipment: Partial<Equipment> = { name: '', description: '', room: undefined, status: 'AVAILABLE', serial_number: '', is_active: true };
  serialNumberError = '';

  ngOnInit() {
    this.api.getRooms().subscribe((rooms) => {
      this.rooms = rooms;
    });
    this.api.getEquipment().subscribe((equipment) => {
      this.equipment = equipment;
      this.updateEquipmentList();
    });
  }

  ngAfterViewInit() {
    // Asegurar que la lista se actualice después de la inicialización
    if (this.equipment.length > 0) {
      this.updateEquipmentList();
    }
  }

  get availableRooms(): Room[] {
    return this.rooms.filter(r => r.status === 'AVAILABLE');
  }

  get totalEquipment(): number {
    return this.equipment.filter(eq => eq.is_active).length;
  }

  get filteredRooms(): Room[] {
    let filtered = this.rooms;

    if (this.filterStatus === 'available') {
      filtered = filtered.filter(r => r.status === 'AVAILABLE');
    } else if (this.filterStatus === 'maintenance') {
      filtered = filtered.filter(r => r.status === 'MAINTENANCE');
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(r => {
        const nameMatch = r.name.toLowerCase().includes(term);
        const descMatch = r.description && r.description.toLowerCase().includes(term);
        const equipmentMatch = r.equipment && r.equipment.some((eq: any) => 
          (eq.name || eq).toString().toLowerCase().includes(term)
        );
        return nameMatch || descMatch || equipmentMatch;
      });
    }

    return filtered;
  }

  getRoomStatus(room: Room): string {
    if (room.status === 'AVAILABLE') return 'Disponible';
    if (room.status === 'MAINTENANCE') return 'Mantenimiento';
    return 'Disponible';
  }

  getRoomStatusClass(room: Room): string {
    if (room.status === 'AVAILABLE') return 'status-available';
    if (room.status === 'MAINTENANCE') return 'status-maintenance';
    return 'status-available';
  }

  getEquipmentNames(equipment: any[]): string {
    if (!equipment || equipment.length === 0) return 'Sin equipamiento';
    return equipment.map(eq => eq.name || eq).join(', ');
  }

  updateEquipmentList() {
    // Actualizar lista de equipos desde la API
    this.equipmentList = this.equipment.map(eq => ({
      id: eq.id,
      name: eq.name,
      room: eq.room_name || 'Sin asignar',
      status: this.getEquipmentStatusLabel(eq.status),
      lastReview: eq.last_maintenance ? new Date(eq.last_maintenance).toLocaleDateString('es-ES') : '—',
      nextReview: eq.last_maintenance ? this.calculateNextReview(eq.last_maintenance) : '—',
    }));
  }

  getEquipmentStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'AVAILABLE': 'Disponible',
      'MAINTENANCE': 'Mantenimiento',
      'OUT_OF_SERVICE': 'Fuera de servicio',
    };
    return labels[status] || status;
  }

  calculateNextReview(lastMaintenance: string): string {
    const date = new Date(lastMaintenance);
    date.setMonth(date.getMonth() + 3); // Próxima revisión en 3 meses
    return date.toLocaleDateString('es-ES');
  }

  editRoom(room: Room) {
    this.editingRoom = { 
      ...room, 
      equipment_ids: room.equipment ? room.equipment.map((eq: any) => eq.id || eq) : []
    };
    this.showNewRoomForm = false;
  }

  isEquipmentSelected(equipmentId: number): boolean {
    const room = this.editingRoom || this.newRoom;
    return room.equipment_ids?.includes(equipmentId) || false;
  }

  toggleEquipment(equipmentId: number) {
    const room = this.editingRoom || this.newRoom;
    if (!room.equipment_ids) {
      room.equipment_ids = [];
    }
    const index = room.equipment_ids.indexOf(equipmentId);
    if (index > -1) {
      room.equipment_ids.splice(index, 1);
    } else {
      room.equipment_ids.push(equipmentId);
    }
  }

  toggleEquipmentDropdown() {
    this.showEquipmentDropdown = !this.showEquipmentDropdown;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.equipment-dropdown-container')) {
      this.showEquipmentDropdown = false;
    }
  }

  getSelectedEquipmentNames(): string {
    const room = this.editingRoom || this.newRoom;
    if (!room.equipment_ids || room.equipment_ids.length === 0) {
      return '';
    }
    const selected = this.equipment
      .filter(eq => room.equipment_ids?.includes(eq.id))
      .map(eq => eq.name);
    return selected.length > 3 
      ? selected.slice(0, 3).join(', ') + ` (+${selected.length - 3} más)`
      : selected.join(', ');
  }

  editEquipment(eq: Equipment) {
    this.editingEquipment = { ...eq };
    this.showNewEquipmentForm = false;
  }

  editEquipmentById(id: number) {
    const eq = this.equipment.find(e => e.id === id);
    if (eq) {
      this.editEquipment(eq);
    }
  }

  saveRoom() {
    if (!this.editingRoom) return;
    const payload: any = {
      name: this.editingRoom.name,
      description: this.editingRoom.description || '',
      status: this.editingRoom.status,
      equipment_ids: this.editingRoom.equipment_ids || [],
    };
    this.api.updateRoom(this.editingRoom.id, payload).subscribe({
      next: (updated) => {
        const index = this.rooms.findIndex(r => r.id === updated.id);
        if (index !== -1) {
          this.rooms[index] = updated;
        }
        this.editingRoom = null;
      },
      error: (err) => {
        console.error('Error al guardar sala:', err);
        alert('Error al guardar la sala');
      }
    });
  }

  saveEquipment() {
    if (!this.editingEquipment) return;
    
    // Validar número de serie si está presente
    if (this.editingEquipment.serial_number) {
      this.validateSerialNumber();
      if (this.serialNumberError) {
        alert('Por favor, corrija el número de serie antes de continuar.');
        return;
      }
    }
    
    this.api.updateEquipment(this.editingEquipment.id, this.editingEquipment).subscribe({
      next: (updated) => {
        const index = this.equipment.findIndex(eq => eq.id === updated.id);
        if (index !== -1) {
          this.equipment[index] = updated;
        }
        this.updateEquipmentList();
        this.editingEquipment = null;
        this.serialNumberError = '';
      },
      error: (err) => {
        console.error('Error al guardar equipo:', err);
        alert('Error al guardar el equipo');
      }
    });
  }

  createRoom() {
    this.api.createRoom(this.newRoom).subscribe({
      next: (created) => {
        this.rooms.push(created);
        this.newRoom = { name: '', description: '', equipment_ids: [], status: 'AVAILABLE' as 'AVAILABLE' | 'MAINTENANCE' };
        this.showNewRoomForm = false;
      },
      error: (err) => {
        console.error('Error al crear sala:', err);
        alert('Error al crear la sala');
      }
    });
  }

  createEquipment() {
    // Validar número de serie si está presente
    if (this.newEquipment.serial_number) {
      this.validateSerialNumber();
      if (this.serialNumberError) {
        alert('Por favor, corrija el número de serie antes de continuar.');
        return;
      }
    }
    
    const payload: any = { ...this.newEquipment };
    if (payload.room === null || payload.room === undefined) {
      delete payload.room;
    }
    this.api.createEquipment(payload).subscribe({
      next: (created) => {
        this.equipment.push(created);
        this.updateEquipmentList();
        this.newEquipment = { name: '', description: '', room: undefined, status: 'AVAILABLE', serial_number: '', is_active: true };
        this.serialNumberError = '';
        this.showNewEquipmentForm = false;
      },
      error: (err) => {
        console.error('Error al crear equipo:', err);
        let errorMessage = 'Error al crear el equipo.';
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
        alert(errorMessage);
      }
    });
  }

  getCurrentEquipmentRoom(): number | null {
    const eq = this.editingEquipment || this.newEquipment;
    return eq.room ?? null;
  }

  setCurrentEquipmentRoom(value: string | number | null) {
    const eq = this.editingEquipment || this.newEquipment;
    if (value === null || value === '' || value === 'null') {
      eq.room = undefined;
    } else {
      eq.room = typeof value === 'string' ? parseInt(value, 10) : value;
    }
  }

  validateSerialNumber() {
    const serial = (this.editingEquipment || this.newEquipment).serial_number?.trim() || '';
    this.serialNumberError = '';
    
    if (!serial) {
      return;
    }
    
    // Validar formato: 2-4 letras, guion opcional, 3-8 números
    // Ejemplos válidos: ABC-123456 o ABC123456
    const patternWithDash = /^[A-Z]{2,4}-[0-9]{3,8}$/i;
    const patternWithoutDash = /^[A-Z]{2,4}[0-9]{3,8}$/i;
    
    if (!patternWithDash.test(serial) && !patternWithoutDash.test(serial)) {
      // Validar si tiene caracteres inválidos
      if (!/^[A-Z0-9\-]+$/i.test(serial)) {
        this.serialNumberError = 'Solo se permiten letras, números y guion (-)';
        return;
      }
      // Validar estructura básica
      if (!/^[A-Z]+/i.test(serial)) {
        this.serialNumberError = 'Debe comenzar con 2-4 letras';
        return;
      }
      if (!/[0-9]+$/.test(serial)) {
        this.serialNumberError = 'Debe terminar con 3-8 números';
        return;
      }
      this.serialNumberError = 'Formato: 2-4 letras, guion opcional, 3-8 números (ej: ABC-123456 o ABC123456)';
      return;
    }
  }

  // Modal states
  showModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'info' | 'confirm' | 'success' | 'error' = 'info';
  modalCallback: (() => void) | null = null;

  confirmDeleteRoom(room: Room) {
    if (!room) return;
    this.showModal = true;
    this.modalType = 'confirm';
    this.modalTitle = 'Confirmar Eliminación';
    this.modalMessage = `¿Está seguro de que desea eliminar la sala "${room.name}"?\n\nEsta acción no se puede deshacer.`;
    this.modalCallback = () => {
      this.deleteRoom(room);
    };
  }

  deleteRoom(room: Room) {
    if (!room) return;
    const roomId = room.id;
    this.api.deleteRoom(roomId).subscribe({
      next: () => {
        this.rooms = this.rooms.filter(r => r.id !== roomId);
        if (this.editingRoom && this.editingRoom.id === roomId) {
          this.editingRoom = null;
          this.showNewRoomForm = false;
        }
        this.closeModal();
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = 'Sala eliminada correctamente.';
        this.modalCallback = null;
      },
      error: (err) => {
        console.error('Error al eliminar sala:', err);
        let errorMessage = 'Error al eliminar la sala.';
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

  deleteEquipment() {
    if (!this.editingEquipment) return;
    const equipmentName = this.editingEquipment.name;
    this.showModal = true;
    this.modalType = 'confirm';
    this.modalTitle = 'Confirmar Eliminación';
    this.modalMessage = `¿Está seguro de que desea eliminar el equipo "${equipmentName}"?\n\nEsta acción no se puede deshacer.`;
    this.modalCallback = () => {
      this.api.deleteEquipment(this.editingEquipment!.id).subscribe({
        next: () => {
          this.equipment = this.equipment.filter(eq => eq.id !== this.editingEquipment!.id);
          this.updateEquipmentList();
          this.editingEquipment = null;
          this.closeModal();
          this.showModal = true;
          this.modalType = 'success';
          this.modalTitle = 'Éxito';
          this.modalMessage = 'Equipo eliminado correctamente.';
          this.modalCallback = null;
        },
        error: (err) => {
          console.error('Error al eliminar equipo:', err);
          this.closeModal();
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = 'Error al eliminar el equipo.';
          this.modalCallback = null;
        }
      });
    };
  }

  closeModal() {
    this.showModal = false;
    this.modalTitle = '';
    this.modalMessage = '';
    this.modalCallback = null;
  }

  handleYesClick() {
    if (this.modalCallback) {
      const callback = this.modalCallback;
      this.modalCallback = null;
      this.closeModal();
      callback();
    } else {
      this.closeModal();
    }
  }

  handleNoClick() {
    this.closeModal();
  }
}
