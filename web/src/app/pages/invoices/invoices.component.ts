import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Invoice, PatientProfile, Service } from '../../core/models';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'dc-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stats-grid">
      <div class="stat-card">
        <h3>€{{ formatCurrency(monthlyBilling) }}</h3>
        <p style="color: white;">Facturación del Mes</p>
      </div>
      <div class="stat-card success">
        <h3>€{{ formatCurrency(paidAmount) }}</h3>
        <p style="color: white;">Cobrado</p>
      </div>
      <div class="stat-card warning">
        <h3>€{{ formatCurrency(pendingAmount) }}</h3>
        <p style="color: white;">Pendiente</p>
      </div>
      <div class="stat-card danger">
        <h3>€{{ formatCurrency(overdueAmount) }}</h3>
        <p style="color: white;">Vencido</p>
      </div>
    </div>

    <!-- Formulario Nueva Factura -->
    <div *ngIf="showNewInvoiceForm" class="section">
      <div class="section-header">
        <h2>Nueva Factura</h2>
      </div>
      <div class="form-section">
        <div class="form-grid">
          <div class="form-group">
            <label>Paciente *</label>
            <select [(ngModel)]="newInvoice.patient_id" required>
              <option [value]="null">Seleccione un paciente</option>
              <option *ngFor="let patient of patients" [value]="patient.id">
                {{ patient.user.first_name }} {{ patient.user.last_name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Fecha de Vencimiento</label>
            <input type="date" [(ngModel)]="newInvoice.due_date" [min]="getMinDate()" [max]="getMaxDate()" />
            <small *ngIf="newInvoice.due_date && !isValidDueDate()" style="color: #f44336; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
              {{ getDueDateErrorMessage() }}
            </small>
            <small *ngIf="!newInvoice.due_date || isValidDueDate()" style="color: #666; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
              Seleccione una fecha válida.
            </small>
          </div>
          <div class="form-group full-width">
            <label>Notas</label>
            <textarea [(ngModel)]="newInvoice.notes" rows="3"></textarea>
          </div>
        </div>
        <div class="form-group full-width">
          <label>Servicios *</label>
          <button type="button" class="btn btn-secondary" (click)="addInvoiceItem()" style="margin-bottom: 1rem;">+ Agregar Servicio</button>
          <div *ngFor="let item of newInvoice.items; let i = index" class="invoice-item-row">
            <div class="equipment-dropdown-container" style="flex: 2;">
              <div class="equipment-dropdown" (click)="toggleServiceDropdown(i)">
                <span *ngIf="!item.service_id || item.service_id === 0" class="dropdown-placeholder">
                  Seleccione servicio
                </span>
                <span *ngIf="item.service_id && item.service_id !== 0" class="dropdown-selected">
                  {{ getServiceName(item.service_id) }}
                </span>
                <span class="dropdown-arrow">▼</span>
              </div>
              <div *ngIf="activeServiceDropdown === i" class="equipment-dropdown-menu">
                <div *ngFor="let service of services" 
                     class="equipment-dropdown-item" 
                     [class.selected]="item.service_id === service.id"
                     (click)="selectServiceForItem(i, service.id)">
                  <span>{{ service.name }}</span>
                </div>
              </div>
            </div>
            <input type="number" [(ngModel)]="item.quantity" min="1" placeholder="Cantidad" style="flex: 1; margin: 0 0.5rem;" (change)="calculateTotal()" />
            <input type="number" [(ngModel)]="item.unit_price" min="0" step="0.01" placeholder="Coste (€)" style="flex: 1; margin-right: 0.5rem;" (change)="calculateTotal()" />
            <button type="button" class="btn btn-danger" (click)="removeInvoiceItem(i)">Eliminar</button>
          </div>
          <div class="invoice-total" style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid #e0e0e0;">
            <strong class="total-amount">Total: €{{ formatCurrency(newInvoice.total || 0) }}</strong>
          </div>
        </div>
        <div style="text-align: right; margin-top: 1rem;">
          <button type="button" class="btn btn-secondary" (click)="showNewInvoiceForm = false" style="margin-right: 0.5rem;">Cancelar</button>
          <button type="button" class="btn btn-primary" (click)="createInvoice()">Crear Factura</button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Facturas</h2>
        <button class="btn btn-primary" (click)="showNewInvoiceForm = true">+ Nueva Factura</button>
      </div>

      <div class="tabs">
        <button class="tab" [class.active]="activeTab === 'all'" (click)="activeTab = 'all'">Todas</button>
        <button class="tab" [class.active]="activeTab === 'pending'" (click)="activeTab = 'pending'">Pendientes</button>
      </div>

      <div class="search-filters">
        <div class="filter-group">
          <label>Buscar factura o paciente</label>
          <input type="text" placeholder="Nº factura, paciente..." [(ngModel)]="searchTerm" />
        </div>
        <div class="filter-group">
          <label>Estado</label>
          <select [(ngModel)]="statusFilter">
            <option value="">Todos</option>
            <option value="DRAFT">Borrador</option>
            <option value="SENT">Enviada</option>
            <option value="PAID">Pagada</option>
            <option value="OVERDUE">Vencida</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Nº Factura</th>
            <th>Fecha</th>
            <th>Paciente</th>
            <th>Servicios</th>
            <th>Importe</th>
            <th>Estado</th>
            <th>Vencimiento</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let invoice of filteredInvoices">
            <td><strong>FAC-{{ invoice.id.toString().padStart(4, '0') }}</strong></td>
            <td>{{ invoice.issued_at | date: 'dd/MM/yyyy' }}</td>
            <td>{{ invoice.patient?.user?.first_name }} {{ invoice.patient?.user?.last_name }}</td>
            <td>{{ getServicesList(invoice) }}</td>
            <td class="amount">{{ invoice.total | currency: 'EUR' }}</td>
            <td>
              <select 
                [ngModel]="invoice.status" 
                (ngModelChange)="changeInvoiceStatus(invoice, $event)"
                class="status-select"
                [ngClass]="'status-' + (invoice.effective_status || invoice.status).toLowerCase()"
                [disabled]="invoice.status === 'PAID'">
                <option *ngFor="let status of getAvailableStatuses(invoice)" [ngValue]="status.value">
                  {{ getStatusLabel(status.value) }}
                </option>
              </select>
            </td>
            <td>{{ invoice.due_date | date: 'dd/MM/yyyy' }}</td>
            <td>
              <div class="invoice-actions">
                <button class="btn btn-secondary" (click)="viewInvoice(invoice)">Ver</button>
                <button class="btn btn-success" (click)="downloadPDF(invoice)">PDF</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Formulario Nuevo/Editar Servicio -->
    <div *ngIf="showNewServiceForm" class="section">
      <div class="section-header">
        <h2>{{ editingService ? 'Editar Servicio' : 'Nuevo Servicio' }}</h2>
      </div>
      <div class="form-section">
        <div class="form-grid">
          <div class="form-group">
            <label>Nombre *</label>
            <input type="text" [(ngModel)]="newService.name" required />
          </div>
          <div class="form-group">
            <label>Precio Base (€) *</label>
            <input type="number" [(ngModel)]="newService.base_price" min="0" step="0.01" required />
          </div>
          <div class="form-group full-width">
            <label>Descripción</label>
            <textarea [(ngModel)]="newService.description" rows="3"></textarea>
          </div>
        </div>
        <div style="text-align: right; margin-top: 1rem;">
          <button type="button" class="btn btn-secondary" (click)="cancelServiceForm()" style="margin-right: 0.5rem;">Cancelar</button>
          <button type="button" class="btn btn-primary" (click)="saveService()">{{ editingService ? 'Guardar Cambios' : 'Crear Servicio' }}</button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Catálogo de Servicios</h2>
        <button class="btn btn-primary" (click)="showNewServiceForm = true">+ Nuevo Servicio</button>
      </div>

      <div class="service-catalog-container">
        <div class="service-catalog">
          <div *ngIf="services.length === 0" class="no-services">
              <p>No hay servicios disponibles</p>
            </div>
          <div class="service-card" *ngFor="let service of services">
            <div class="service-card-header">
            <h4>{{ service.name }}</h4>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary btn-small" (click)="editService(service)">Editar</button>
                <button class="btn btn-danger btn-small" (click)="confirmDeleteService(service)">Eliminar</button>
              </div>
            </div>
            <div class="price">{{ service.base_price | currency: 'EUR' }}</div>
            <div class="description">{{ service.description || 'Sin descripción' }}</div>
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
          <button *ngIf="modalType === 'confirm'" class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
          <button *ngIf="modalType === 'confirm'" class="btn btn-primary" (click)="confirmModal()">Confirmar</button>
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

      .stat-card.success {
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        color: white;
      }

      .stat-card.warning {
        background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
        color: white;
      }

      .stat-card.danger {
        background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
        color: white;
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

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgba(102, 126, 234, 0.4);
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

      .tabs {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
        border-bottom: 2px solid #f0f0f0;
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

      .search-filters {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
      }

      .filter-group {
        flex: 1;
        min-width: 200px;
      }

      .filter-group label {
        display: block;
        margin-bottom: 0.5rem;
        color: #666;
        font-weight: 500;
        font-size: 0.9rem;
      }

      .filter-group input,
      .filter-group select {
        width: 100%;
        padding: 0.8rem;
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        font-size: 1rem;
      }

      .filter-group input:focus,
      .filter-group select:focus {
        outline: none;
        border-color: #667eea;
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

      .status-select {
        padding: 0.4rem 0.8rem;
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        background-color: white;
        color: #333;
        min-width: 120px;
        transition: all 0.3s;
      }

      .status-select:hover {
        border-color: #667eea;
      }

      .status-select:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .status-select.status-draft {
        background-color: #f5f5f5;
        color: #666;
        border-color: #e0e0e0;
      }

      .status-select.status-sent {
        background-color: #e3f2fd;
        color: #1976d2;
        border-color: #90caf9;
      }

      .status-select.status-paid {
        background-color: #e8f5e9;
        color: #2e7d32;
        border-color: #81c784;
      }

      .status-select.status-overdue {
        background-color: #ffebee;
        color: #c62828;
        border-color: #ef5350;
      }

      .status-select.status-cancelled {
        background-color: #fce4ec;
        color: #c2185b;
        border-color: #f48fb1;
      }

      .status-select:disabled {
        cursor: not-allowed;
        opacity: 0.7;
        background-color: #e8f5e9 !important;
        color: #2e7d32 !important;
        border-color: #81c784 !important;
      }

      .status-badge {
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        display: inline-block;
      }

      .status-paid {
        background-color: #e8f5e9;
        color: #4CAF50;
      }

      .status-pending {
        background-color: #fff3e0;
        color: #ff9800;
      }

      .status-overdue {
        background-color: #ffebee;
        color: #f44336;
      }

      .amount {
        font-weight: 600;
        color: #333;
      }

      .invoice-actions {
        display: flex;
        gap: 0.5rem;
      }

      .invoice-actions .btn {
        padding: 0.4rem 0.8rem;
        font-size: 0.85rem;
      }

      .service-catalog {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }

      .service-card {
        border: 2px solid #f0f0f0;
        border-radius: 10px;
        padding: 1rem;
        background-color: #fafafa;
        transition: all 0.3s;
      }

      .service-card:hover {
        border-color: #667eea;
        background-color: white;
        transform: translateY(-3px);
        box-shadow: 0 4px 10px rgba(102, 126, 234, 0.2);
      }

      .service-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .service-card h4 {
        color: #667eea;
        margin: 0;
        flex: 1;
      }

      .btn-small {
        padding: 0.3rem 0.8rem;
        font-size: 0.85rem;
      }

      .service-card .price {
        font-size: 1.3rem;
        font-weight: 600;
        color: #4CAF50;
        margin-top: 0.5rem;
      }

      .service-card .description {
        color: #666;
        font-size: 0.9rem;
        margin-top: 0.5rem;
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

      .invoice-item-row {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
        align-items: center;
      }

      .invoice-total {
        text-align: right;
      }

      .total-amount {
        font-size: 1.8rem;
        font-weight: bold;
        color: #667eea;
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

      .service-catalog-container {
        margin-top: 1rem;
      }

      .service-catalog-container label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: #333;
      }

      .equipment-dropdown-container {
        position: relative;
        margin-bottom: 1rem;
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

      .no-services {
        text-align: center;
        padding: 2rem;
        color: #999;
      }
    `,
  ],
})
export class InvoicesComponent implements OnInit {
  private readonly api = inject(ApiService);
  
  invoices: Invoice[] = [];
  services: Service[] = [];
  activeTab = 'all';
  searchTerm = '';
  statusFilter = '';
  showNewInvoiceForm = false;
  showNewServiceForm = false;
  editingService: Service | null = null;
  activeServiceDropdown: number | null = null;
  
  // Modal states
  showModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'info' | 'confirm' | 'success' | 'error' = 'info';
  modalCallback: (() => void) | null = null;
  
  // Form data
  newInvoice = {
    patient_id: null as number | null,
    items: [] as Array<{ service_id: number; quantity: number; unit_price: number }>,
    due_date: '',
    notes: '',
    total: 0,
  };
  
  newService = {
    name: '',
    description: '',
    base_price: 0,
    is_active: true,
  };
  
  selectedInvoice: Invoice | null = null;
  patients: PatientProfile[] = [];
  
  ngOnInit() {
    this.loadData();
    this.api.getPatients().subscribe(patients => this.patients = patients);
  }
  
  loadData() {
    this.api.getInvoices().subscribe((invoices) => (this.invoices = invoices));
    this.api.getServices().subscribe((services) => (this.services = services));
  }

  get monthlyBilling(): number {
    const now = new Date();
    return this.invoices
      .filter(inv => {
        const invDate = new Date(inv.issued_at);
        return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, inv) => sum + (typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total || 0), 0);
  }

  get paidAmount(): number {
    return this.invoices
      .filter(inv => inv.status === 'PAID')
      .reduce((sum, inv) => sum + (typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total || 0), 0);
  }

  get pendingAmount(): number {
    return this.invoices
      .filter(inv => {
        const status = inv.effective_status || inv.status;
        return status === 'SENT' || status === 'DRAFT';
      })
      .reduce((sum, inv) => sum + (typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total || 0), 0);
  }

  get overdueAmount(): number {
    return this.invoices
      .filter(inv => {
        // Usar effective_status si está disponible, sino calcularlo
        const status = inv.effective_status || inv.status;
        if (status === 'OVERDUE') return true;
        // Si está SENT y la fecha de vencimiento ha pasado
        if (status === 'SENT' && inv.due_date) {
          const dueDate = new Date(inv.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return dueDate < today;
        }
        return false;
      })
      .reduce((sum, inv) => sum + (typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total || 0), 0);
  }

  formatCurrency(value: number): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }
    // Formatear con punto como separador de miles, sin decimales
    const integerValue = Math.round(value);
    return integerValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  get filteredInvoices(): Invoice[] {
    let filtered = this.invoices;

    if (this.activeTab === 'pending') {
      filtered = filtered.filter(inv => inv.status !== 'PAID');
    }

    if (this.statusFilter) {
      filtered = filtered.filter(inv => inv.status === this.statusFilter);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(inv => {
        // Buscar por número de factura (formato: FAC-0001, FAC-1, 0001, 1)
        const invoiceNumber = `FAC-${inv.id.toString().padStart(4, '0')}`.toLowerCase();
        const invoiceNumberShort = `FAC-${inv.id}`.toLowerCase();
        const invoiceIdPadded = inv.id.toString().padStart(4, '0');
        const invoiceId = inv.id.toString();
        
        const matchesInvoiceNumber = 
          invoiceNumber.includes(term) ||
          invoiceNumberShort.includes(term) ||
          invoiceIdPadded.includes(term) ||
          invoiceId.includes(term);
        
        // Buscar por paciente
        const patientName = `${inv.patient?.user?.first_name} ${inv.patient?.user?.last_name}`.toLowerCase();
        const matchesPatient = patientName.includes(term);
        
        return matchesInvoiceNumber || matchesPatient;
      });
    }

    return filtered;
  }

  getServicesList(invoice: Invoice): string {
    if (!invoice.items || invoice.items.length === 0) return 'Sin servicios';
    return invoice.items.map(item => item.service_detail?.name || 'Servicio').join(', ');
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'DRAFT': 'Borrador',
      'PAID': 'Pagada',
      'PENDING': 'Pendiente',
      'SENT': 'Enviada',
      'OVERDUE': 'Vencida',
      'CANCELLED': 'Cancelada',
    };
    return labels[status] || status;
  }

  getAvailableStatuses(invoice: Invoice): Array<{ value: string; label: string }> {
    // Usar el status real guardado, no el effective_status calculado
    const currentStatus = invoice.status;
    
    // Si está pagada, solo puede mostrar "Pagada" (y está deshabilitado)
    if (currentStatus === 'PAID') {
      return [{ value: 'PAID', label: 'Pagada' }];
    }
    
    // Si está en borrador, puede cambiar a cualquier estado
    if (currentStatus === 'DRAFT') {
      return [
        { value: 'DRAFT', label: 'Borrador' },
        { value: 'SENT', label: 'Enviada' },
        { value: 'PAID', label: 'Pagada' },
        { value: 'OVERDUE', label: 'Vencida' },
        { value: 'CANCELLED', label: 'Cancelada' },
      ];
    }
    
    // Si ya no está en borrador, no puede volver a borrador
    // Pero asegurarse de incluir el estado actual si es OVERDUE o CANCELLED
    const availableStatuses = [
      { value: 'SENT', label: 'Enviada' },
      { value: 'PAID', label: 'Pagada' },
      { value: 'OVERDUE', label: 'Vencida' },
      { value: 'CANCELLED', label: 'Cancelada' },
    ];
    
    // Asegurar que el estado actual esté en la lista (por si acaso)
    const hasCurrentStatus = availableStatuses.some(s => s.value === currentStatus);
    if (!hasCurrentStatus && (currentStatus === 'OVERDUE' || currentStatus === 'CANCELLED')) {
      // Si el estado actual es OVERDUE o CANCELLED y no está en la lista, agregarlo al principio
      availableStatuses.unshift({ 
        value: currentStatus, 
        label: this.getStatusLabel(currentStatus) 
      });
    }
    
    return availableStatuses;
  }

  viewInvoice(invoice: Invoice) {
    this.selectedInvoice = invoice;
    this.showModal = true;
    this.modalType = 'info';
    this.modalTitle = `Factura FAC-${invoice.id.toString().padStart(4, '0')}`;
    this.modalMessage = `Paciente: ${invoice.patient?.user?.first_name} ${invoice.patient?.user?.last_name}\nTotal: ${invoice.total}€\nFecha: ${new Date(invoice.issued_at).toLocaleDateString('es-ES')}\nEstado: ${this.getStatusLabel(invoice.effective_status || invoice.status)}`;
  }

  downloadPDF(invoice: Invoice) {
    // Descargar PDF directamente sin mostrar modal
    this.api.downloadInvoicePDF(invoice.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `factura_${invoice.id.toString().padStart(4, '0')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error al descargar PDF:', err);
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = 'Error al generar el PDF de la factura.';
        this.modalCallback = null;
      }
    });
  }

  markAsPaid(invoice: Invoice) {
    this.showModal = true;
    this.modalType = 'confirm';
    this.modalTitle = 'Confirmar Pago';
    this.modalMessage = `¿Marcar factura FAC-${invoice.id.toString().padStart(4, '0')} como pagada?`;
    this.modalCallback = () => {
      this.api.markInvoicePaid(invoice.id).subscribe({
        next: () => {
          invoice.status = 'PAID';
          this.showModal = true;
          this.modalType = 'success';
          this.modalTitle = 'Éxito';
          this.modalMessage = 'Factura marcada como pagada correctamente.';
          this.modalCallback = null;
          this.loadData();
        },
        error: (err) => {
          console.error('Error al marcar factura como pagada:', err);
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = 'Error al marcar la factura como pagada.';
          this.modalCallback = null;
        }
      });
    };
  }

  changeInvoiceStatus(invoice: Invoice, newStatus: string) {
    const currentStatus = invoice.status;
    
    // Si el estado no cambió, no hacer nada
    if (newStatus === currentStatus) {
      return;
    }
    
    // Si cambia a PAID, usar el método markInvoicePaid
    if (newStatus === 'PAID') {
      this.markAsPaid(invoice);
      return;
    }
    
    // Para otros cambios de estado, actualizar directamente
    this.api.updateInvoice(invoice.id, { status: newStatus }).subscribe({
      next: (updatedInvoice) => {
        // Actualizar el objeto invoice con los datos del servidor
        invoice.status = updatedInvoice.status;
        invoice.effective_status = updatedInvoice.effective_status || updatedInvoice.status;
        this.loadData();
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = `Estado de la factura actualizado a "${this.getStatusLabel(newStatus)}" correctamente.`;
        this.modalCallback = null;
      },
      error: (err) => {
        console.error('Error al actualizar estado de factura:', err);
        // Revertir el cambio en el invoice
        invoice.status = currentStatus;
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = 'Error al actualizar el estado de la factura.';
        this.modalCallback = null;
      }
    });
  }

  sendReminder(invoice: Invoice) {
    this.showModal = true;
    this.modalType = 'info';
    this.modalTitle = 'Recordatorio';
    this.modalMessage = `Se enviará un recordatorio de pago para la factura FAC-${invoice.id.toString().padStart(4, '0')} al paciente.`;
    this.modalCallback = null;
  }

  closeModal() {
    this.showModal = false;
    this.modalTitle = '';
    this.modalMessage = '';
    this.modalCallback = null;
    this.selectedInvoice = null;
  }

  confirmModal() {
    if (this.modalCallback) {
      this.modalCallback();
    }
    this.closeModal();
  }

  createInvoice() {
    if (!this.newInvoice.patient_id || this.newInvoice.items.length === 0) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Debe seleccionar un paciente y al menos un servicio.';
      return;
    }
    
    // Validar que todos los items tengan servicio válido y precio
    const invalidItems = this.newInvoice.items.filter(item => 
      !item.service_id || item.service_id === 0 || !item.unit_price || item.unit_price <= 0
    );
    if (invalidItems.length > 0) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Todos los servicios deben estar seleccionados correctamente y tener un coste válido.';
      return;
    }

    // Validar fecha de vencimiento
    if (this.newInvoice.due_date && !this.isValidDueDate()) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = this.getDueDateErrorMessage();
      return;
    }
    
    const payload: any = {
      patient_id: this.newInvoice.patient_id,
      items: this.newInvoice.items.map(item => ({
        service: item.service_id,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
      })),
    };
    
    if (this.newInvoice.due_date) {
      payload.due_date = this.newInvoice.due_date;
    }
    if (this.newInvoice.notes) {
      payload.notes = this.newInvoice.notes;
    }
    
    this.api.createInvoice(payload).subscribe({
      next: () => {
        this.showNewInvoiceForm = false;
        this.newInvoice = { patient_id: null, items: [], due_date: '', notes: '', total: 0 };
        this.loadData();
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = 'Factura creada correctamente.';
      },
      error: (err) => {
        console.error('Error al crear factura:', err);
        let errorMessage = 'Error al crear la factura.';
        
        if (err.error) {
          // Si es un string directo
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } 
          // Si tiene la propiedad detail
          else if (err.error.detail && typeof err.error.detail === 'string') {
            errorMessage = err.error.detail;
          } 
          // Si es un objeto, buscar el primer mensaje de error
          else if (typeof err.error === 'object') {
            const errorKeys = Object.keys(err.error);
            if (errorKeys.length > 0) {
              const firstKey = errorKeys[0];
              const firstError = err.error[firstKey];
              
              if (Array.isArray(firstError) && firstError.length > 0) {
                // Si es un array, tomar el primer elemento
                errorMessage = typeof firstError[0] === 'string' 
                  ? firstError[0] 
                  : `Error en ${firstKey}: ${JSON.stringify(firstError[0])}`;
              } else if (typeof firstError === 'string') {
                errorMessage = firstError;
              } else if (typeof firstError === 'object') {
                // Si es un objeto anidado, intentar extraer un mensaje
                errorMessage = `Error en ${firstKey}. Por favor, verifique los datos ingresados.`;
              } else {
                errorMessage = `Error en ${firstKey}. Por favor, verifique los datos ingresados.`;
              }
            }
          }
        }
        
        // Asegurar que siempre sea un string
        if (typeof errorMessage !== 'string') {
          errorMessage = 'Error al crear la factura. Por favor, verifique los datos ingresados.';
              }
        
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = errorMessage;
      }
    });
  }

  addInvoiceItem() {
    this.newInvoice.items.push({ service_id: 0, quantity: 1, unit_price: 0 });
    this.calculateTotal();
  }

  calculateTotal() {
    this.newInvoice.total = this.newInvoice.items.reduce((sum, item) => {
      return sum + (item.quantity * (item.unit_price || 0));
    }, 0);
  }

  removeInvoiceItem(index: number) {
    this.newInvoice.items.splice(index, 1);
    if (this.activeServiceDropdown === index) {
      this.activeServiceDropdown = null;
    }
    this.calculateTotal();
  }

  toggleServiceDropdown(index: number) {
    this.activeServiceDropdown = this.activeServiceDropdown === index ? null : index;
  }

  selectServiceForItem(itemIndex: number, serviceId: number) {
    this.newInvoice.items[itemIndex].service_id = serviceId;
    // Actualizar siempre el precio al precio base del servicio seleccionado
    const service = this.services.find(s => s.id === serviceId);
    if (service) {
      this.newInvoice.items[itemIndex].unit_price = service.base_price;
      // Establecer siempre la cantidad a 1 cuando se selecciona un servicio
      this.newInvoice.items[itemIndex].quantity = 1;
    }
    this.calculateTotal();
    this.activeServiceDropdown = null;
  }

  getServiceName(serviceId: number): string {
    const service = this.services.find(s => s.id === serviceId);
    return service ? service.name : '';
  }

  getMinDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  getMaxDate(): string {
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    return maxDate.toISOString().split('T')[0];
  }

  isValidDueDate(): boolean {
    if (!this.newInvoice.due_date) {
      return true; // Si no hay fecha, es válido (opcional)
    }

    const dueDate = new Date(this.newInvoice.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    maxDate.setHours(23, 59, 59, 999);

    return dueDate >= today && dueDate <= maxDate;
  }

  getDueDateErrorMessage(): string {
    if (!this.newInvoice.due_date) {
      return '';
    }

    const dueDate = new Date(this.newInvoice.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    maxDate.setHours(23, 59, 59, 999);

    if (dueDate < today || dueDate > maxDate) {
      return 'La fecha es incorrecta';
    }

    return '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.equipment-dropdown-container')) {
      this.activeServiceDropdown = null;
    }
  }

  editService(service: Service) {
    this.editingService = service;
    this.newService = {
      name: service.name,
      description: service.description || '',
      base_price: service.base_price,
      is_active: service.is_active !== undefined ? service.is_active : true,
    };
    this.showNewServiceForm = true;
  }

  cancelServiceForm() {
    this.showNewServiceForm = false;
    this.editingService = null;
    this.newService = { name: '', description: '', base_price: 0, is_active: true };
  }

  saveService() {
    if (!this.newService.name || this.newService.base_price <= 0) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Debe completar el nombre y el precio del servicio.';
      return;
    }
    
    if (this.editingService) {
      // Actualizar servicio existente
      this.api.updateService(this.editingService.id, this.newService).subscribe({
        next: () => {
          this.showNewServiceForm = false;
          this.editingService = null;
          this.newService = { name: '', description: '', base_price: 0, is_active: true };
          this.loadData();
          this.showModal = true;
          this.modalType = 'success';
          this.modalTitle = 'Éxito';
          this.modalMessage = 'Servicio actualizado correctamente.';
        },
        error: (err) => {
          console.error('Error al actualizar servicio:', err);
          let errorMessage = 'Error al actualizar el servicio.';
          
          if (err.error) {
            if (typeof err.error === 'string') {
              errorMessage = err.error;
            } else if (err.error.detail && typeof err.error.detail === 'string') {
              errorMessage = err.error.detail;
            } else if (typeof err.error === 'object') {
              const errorKeys = Object.keys(err.error);
              if (errorKeys.length > 0) {
                const firstKey = errorKeys[0];
                const firstError = err.error[firstKey];
                
                if (Array.isArray(firstError) && firstError.length > 0) {
                  errorMessage = typeof firstError[0] === 'string' 
                    ? firstError[0] 
                    : `Error en ${firstKey}. Por favor, verifique los datos ingresados.`;
                } else if (typeof firstError === 'string') {
                  errorMessage = firstError;
                } else {
                  errorMessage = `Error en ${firstKey}. Por favor, verifique los datos ingresados.`;
                }
              }
            }
          }
          
          if (typeof errorMessage !== 'string') {
            errorMessage = 'Error al actualizar el servicio. Por favor, verifique los datos ingresados.';
          }
          
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = errorMessage;
        }
      });
    } else {
      // Crear nuevo servicio
      this.api.createService(this.newService).subscribe({
        next: () => {
          this.showNewServiceForm = false;
          this.newService = { name: '', description: '', base_price: 0, is_active: true };
          this.loadData();
          this.showModal = true;
          this.modalType = 'success';
          this.modalTitle = 'Éxito';
          this.modalMessage = 'Servicio creado correctamente.';
        },
        error: (err) => {
          console.error('Error al crear servicio:', err);
          let errorMessage = 'Error al crear el servicio.';
          
          if (err.error) {
            if (typeof err.error === 'string') {
              errorMessage = err.error;
            } else if (err.error.detail && typeof err.error.detail === 'string') {
              errorMessage = err.error.detail;
            } else if (typeof err.error === 'object') {
              const errorKeys = Object.keys(err.error);
              if (errorKeys.length > 0) {
                const firstKey = errorKeys[0];
                const firstError = err.error[firstKey];
                
                if (Array.isArray(firstError) && firstError.length > 0) {
                  errorMessage = typeof firstError[0] === 'string' 
                    ? firstError[0] 
                    : `Error en ${firstKey}. Por favor, verifique los datos ingresados.`;
                } else if (typeof firstError === 'string') {
                  errorMessage = firstError;
                } else {
                  errorMessage = `Error en ${firstKey}. Por favor, verifique los datos ingresados.`;
                }
              }
            }
          }
          
          if (typeof errorMessage !== 'string') {
            errorMessage = 'Error al crear el servicio. Por favor, verifique los datos ingresados.';
          }
          
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = errorMessage;
        }
      });
    }
  }

  confirmDeleteService(service: Service) {
    this.showModal = true;
    this.modalType = 'confirm';
    this.modalTitle = 'Confirmar Eliminación';
    this.modalMessage = `¿Está seguro de que desea eliminar el servicio "${service.name}"?\n\nEsta acción no se puede deshacer.`;
    this.modalCallback = () => {
      this.deleteService(service);
    };
  }

  deleteService(service: Service) {
    if (!service) return;
    const serviceId = service.id;
    this.api.deleteService(serviceId).subscribe({
      next: () => {
        this.services = this.services.filter(s => s.id !== serviceId);
        this.closeModal();
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = 'Servicio eliminado correctamente.';
        this.modalCallback = null;
      },
      error: (err) => {
        console.error('Error al eliminar servicio:', err);
        let errorMessage = 'Error al eliminar el servicio.';
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
}

