import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { User } from '../../core/models';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'dc-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="section" *ngIf="!selectedUser && !showNewUserForm">
      <div class="section-header">
        <h2>Gestión de Usuarios</h2>
        <button class="btn btn-primary" (click)="showNewUserForm = true">+ Nuevo Usuario</button>
      </div>

      <div class="search-bar">
        <input type="text" placeholder="Buscar usuario..." [(ngModel)]="searchTerm" />
      </div>

      <div class="users-table">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of filteredUsers">
              <td>{{ user.first_name }} {{ user.last_name }}</td>
              <td>{{ user.email }}</td>
              <td>
                <span class="role-badge" [ngClass]="'role-' + user.role.toLowerCase()">
                  {{ getRoleLabel(user.role) }}
                </span>
              </td>
              <td>{{ user.phone || '—' }}</td>
              <td>
                <span class="status-badge" [ngClass]="user.is_active ? 'active' : 'inactive'">
                  {{ user.is_active ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td>
                <button class="btn btn-small btn-primary" (click)="editUser(user)">Editar</button>
                <button 
                  *ngIf="user.id !== currentUserId" 
                  class="btn btn-small" 
                  [ngClass]="user.is_active ? 'btn-warning' : 'btn-primary'"
                  (click)="confirmToggleUserStatus(user)"
                  style="margin-left: 0.5rem;">
                  {{ user.is_active ? 'Desactivar' : 'Activar' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Formulario de nuevo usuario -->
    <div *ngIf="showNewUserForm" class="section">
      <div class="section-header">
        <h2>Nuevo Usuario</h2>
      </div>
      
      <form (ngSubmit)="createUser()" class="form-section">
        <div class="form-grid">
          <div class="form-group">
            <label>Nombre *</label>
            <input type="text" [(ngModel)]="newUser.first_name" name="first_name" required />
          </div>
          <div class="form-group">
            <label>Apellidos *</label>
            <input type="text" [(ngModel)]="newUser.last_name" name="last_name" required />
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" [(ngModel)]="newUser.email" name="email" required />
          </div>
          <div class="form-group">
            <label>Username *</label>
            <input type="text" [(ngModel)]="newUser.username" name="username" required />
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input type="tel" [(ngModel)]="newUser.phone" name="phone" />
          </div>
          <div class="form-group">
            <label>Rol *</label>
            <select [(ngModel)]="newUser.role" name="role" required>
              <option value="PATIENT">Paciente</option>
              <option value="PROFESSIONAL">Profesional</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div class="form-group">
            <label>Contraseña *</label>
            <input type="password" [(ngModel)]="newUser.password" name="password" required />
          </div>
        </div>
        <div style="text-align: right; margin-top: 1rem;">
          <button type="button" class="btn btn-secondary" (click)="cancelNewUser()" style="margin-right: 0.5rem;">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="creating">Crear Usuario</button>
        </div>
      </form>
    </div>

    <!-- Formulario de edición -->
    <div *ngIf="selectedUser && !showNewUserForm" class="section">
      <div class="section-header">
        <h2>Editar Usuario</h2>
        <button class="btn btn-secondary" (click)="cancelEdit()">Volver</button>
      </div>
      
      <form (ngSubmit)="saveUser()" class="form-section">
        <div class="form-grid">
          <div class="form-group">
            <label>Nombre *</label>
            <input type="text" [(ngModel)]="selectedUser.first_name" name="first_name" required />
          </div>
          <div class="form-group">
            <label>Apellidos *</label>
            <input type="text" [(ngModel)]="selectedUser.last_name" name="last_name" required />
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" [(ngModel)]="selectedUser.email" name="email" required />
          </div>
          <div class="form-group">
            <label>Username *</label>
            <input type="text" [(ngModel)]="selectedUser.username" name="username" required />
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input type="tel" [(ngModel)]="selectedUser.phone" name="phone" />
          </div>
          <div class="form-group">
            <label>Rol *</label>
            <select [(ngModel)]="selectedUser.role" name="role" required>
              <option value="PATIENT">Paciente</option>
              <option value="PROFESSIONAL">Profesional</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
        </div>
        <div style="text-align: right; margin-top: 1rem;">
          <button type="button" class="btn btn-secondary" (click)="cancelEdit()" style="margin-right: 0.5rem;">Cancelar</button>
          <button type="button" class="btn btn-warning" (click)="toggleUserStatus()" style="margin-right: 0.5rem;">
            {{ selectedUser.is_active ? 'Desactivar' : 'Activar' }}
          </button>
          <button type="submit" class="btn btn-primary">Guardar Cambios</button>
        </div>
      </form>
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

      .btn-warning {
        background-color: #ff9800;
        color: white;
      }

      .btn-danger {
        background-color: #f44336;
        color: white;
      }

      .btn-small {
        padding: 0.4rem 0.8rem;
        font-size: 0.9rem;
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

      .users-table {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      thead {
        background-color: #f0f0f0;
      }

      th, td {
        padding: 1rem;
        text-align: left;
        border-bottom: 1px solid #e0e0e0;
      }

      th {
        font-weight: 600;
        color: #667eea;
      }

      tr:hover {
        background-color: #fafafa;
      }

      .role-badge {
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 500;
      }

      .role-patient {
        background-color: #2196F3;
        color: white;
      }

      .role-professional {
        background-color: #4CAF50;
        color: white;
      }

      .role-admin {
        background-color: #f44336;
        color: white;
      }

      .status-badge {
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 500;
      }

      .status-badge.active {
        background-color: #4CAF50;
        color: white;
      }

      .status-badge.inactive {
        background-color: #999;
        color: white;
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

      input, select {
        padding: 0.8rem;
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        font-size: 1rem;
        transition: border-color 0.3s;
      }

      input:focus, select:focus {
        outline: none;
        border-color: #667eea;
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
export class UsersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  users: (User & { is_active?: boolean })[] = [];
  selectedUser: (User & { is_active?: boolean }) | null = null;
  searchTerm = '';
  showNewUserForm = false;
  creating = false;
  currentUserId: number | null = null;

  // Modal states
  showModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'info' | 'confirm' | 'success' | 'error' = 'info';
  modalCallback: (() => void) | null = null;

  newUser: any = {
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    phone: '',
    role: 'PATIENT',
    password: '',
  };

  ngOnInit() {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser) {
      this.currentUserId = currentUser.id;
    }
    this.loadUsers();
  }

  loadUsers() {
    this.api.getUsers().subscribe({
      next: (users) => {
        this.users = users;
      },
      error: (err) => {
        console.error('Error al cargar usuarios:', err);
        this.showModal = true;
        this.modalType = 'error';
        this.modalTitle = 'Error';
        this.modalMessage = 'Error al cargar los usuarios.';
        this.modalCallback = null;
      },
    });
  }

  get filteredUsers(): (User & { is_active?: boolean })[] {
    if (!this.searchTerm) return this.users;
    const term = this.searchTerm.toLowerCase();
    return this.users.filter(u =>
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term)
    );
  }

  getRoleLabel(role: string): string {
    const labels: { [key: string]: string } = {
      'PATIENT': 'Paciente',
      'PROFESSIONAL': 'Profesional',
      'ADMIN': 'Administrador',
    };
    return labels[role] || role;
  }

  editUser(user: User & { is_active?: boolean }) {
    this.selectedUser = { ...user };
  }

  cancelEdit() {
    this.selectedUser = null;
  }

  cancelNewUser() {
    this.showNewUserForm = false;
    this.resetNewUserForm();
  }

  resetNewUserForm() {
    this.newUser = {
      first_name: '',
      last_name: '',
      email: '',
      username: '',
      phone: '',
      role: 'PATIENT',
      password: '',
    };
  }

  createUser() {
    if (!this.newUser.first_name || !this.newUser.last_name || !this.newUser.email || !this.newUser.username || !this.newUser.password) {
      this.showModal = true;
      this.modalType = 'error';
      this.modalTitle = 'Error';
      this.modalMessage = 'Por favor, complete todos los campos obligatorios.';
      this.modalCallback = null;
      return;
    }

    this.creating = true;
    this.api.createUser(this.newUser).subscribe({
      next: () => {
        this.creating = false;
        this.showNewUserForm = false;
        this.resetNewUserForm();
        this.loadUsers();
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = 'Usuario creado correctamente.';
        this.modalCallback = null;
      },
      error: (err) => {
        this.creating = false;
        console.error('Error al crear usuario:', err);
        let errorMsg = 'Error al crear el usuario.';
        if (err.error && typeof err.error === 'object') {
          const errorKeys = Object.keys(err.error);
          if (errorKeys.length > 0) {
            const firstError = err.error[errorKeys[0]];
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

  saveUser() {
    if (!this.selectedUser) return;
    
    const payload: any = {
      first_name: this.selectedUser.first_name,
      last_name: this.selectedUser.last_name,
      email: this.selectedUser.email,
      username: this.selectedUser.username,
      phone: this.selectedUser.phone,
      role: this.selectedUser.role,
    };

    this.api.updateUser(this.selectedUser.id, payload).subscribe({
      next: () => {
        this.loadUsers();
        this.selectedUser = null;
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = 'Usuario actualizado correctamente.';
        this.modalCallback = null;
      },
      error: (err) => {
        console.error('Error al actualizar usuario:', err);
        let errorMsg = 'Error al actualizar el usuario.';
        if (err.error && typeof err.error === 'object') {
          const errorKeys = Object.keys(err.error);
          if (errorKeys.length > 0) {
            const firstError = err.error[errorKeys[0]];
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

  toggleUserStatus() {
    if (!this.selectedUser) return;
    
    if (this.selectedUser.is_active) {
      this.api.deactivateUser(this.selectedUser.id).subscribe({
        next: () => {
          this.selectedUser!.is_active = false;
          this.loadUsers();
          this.showModal = true;
          this.modalType = 'success';
          this.modalTitle = 'Éxito';
          this.modalMessage = 'Usuario desactivado correctamente.';
          this.modalCallback = null;
        },
        error: (err) => {
          console.error('Error al desactivar usuario:', err);
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = 'Error al desactivar el usuario.';
          this.modalCallback = null;
        },
      });
    } else {
      this.api.activateUser(this.selectedUser.id).subscribe({
        next: () => {
          this.selectedUser!.is_active = true;
          this.loadUsers();
          this.showModal = true;
          this.modalType = 'success';
          this.modalTitle = 'Éxito';
          this.modalMessage = 'Usuario activado correctamente.';
          this.modalCallback = null;
        },
        error: (err) => {
          console.error('Error al activar usuario:', err);
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = 'Error al activar el usuario.';
          this.modalCallback = null;
        },
      });
    }
  }

  confirmToggleUserStatus(user: User & { is_active?: boolean }) {
    this.showModal = true;
    this.modalType = 'confirm';
    if (user.is_active) {
      this.modalTitle = 'Confirmar Desactivación';
      this.modalMessage = `¿Está seguro de que desea desactivar al usuario "${user.first_name} ${user.last_name}"?\n\nEl usuario no podrá acceder al sistema hasta que sea reactivado.`;
    } else {
      this.modalTitle = 'Confirmar Activación';
      this.modalMessage = `¿Está seguro de que desea activar al usuario "${user.first_name} ${user.last_name}"?\n\nEl usuario podrá acceder al sistema nuevamente.`;
    }
    this.modalCallback = () => {
      this.toggleUserStatusFromList(user);
    };
  }

  toggleUserStatusFromList(user: User & { is_active?: boolean }) {
    if (user.is_active) {
      this.api.deactivateUser(user.id).subscribe({
        next: () => {
          this.loadUsers();
          this.closeModal();
          this.showModal = true;
          this.modalType = 'success';
          this.modalTitle = 'Éxito';
          this.modalMessage = 'Usuario desactivado correctamente.';
          this.modalCallback = null;
        },
        error: (err) => {
          console.error('Error al desactivar usuario:', err);
          let errorMsg = 'Error al desactivar el usuario.';
          if (err.error && err.error.detail) {
            errorMsg = err.error.detail;
          }
          this.closeModal();
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = errorMsg;
          this.modalCallback = null;
        },
      });
    } else {
      this.api.activateUser(user.id).subscribe({
        next: () => {
          this.loadUsers();
          this.closeModal();
          this.showModal = true;
          this.modalType = 'success';
          this.modalTitle = 'Éxito';
          this.modalMessage = 'Usuario activado correctamente.';
          this.modalCallback = null;
        },
        error: (err) => {
          console.error('Error al activar usuario:', err);
          let errorMsg = 'Error al activar el usuario.';
          if (err.error && err.error.detail) {
            errorMsg = err.error.detail;
          }
          this.closeModal();
          this.showModal = true;
          this.modalType = 'error';
          this.modalTitle = 'Error';
          this.modalMessage = errorMsg;
          this.modalCallback = null;
        },
      });
    }
  }

  closeModal() {
    this.showModal = false;
    this.modalTitle = '';
    this.modalMessage = '';
    this.modalCallback = null;
  }

  confirmModal() {
    if (this.modalCallback) {
      const callback = this.modalCallback;
      this.modalCallback = null;
      this.closeModal();
      callback();
    } else {
      this.closeModal();
    }
  }
}

