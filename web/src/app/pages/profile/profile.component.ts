import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { User } from '../../core/models';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'dc-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="section">
      <div class="section-header">
        <h2>Mi Perfil</h2>
      </div>

      <div class="tabs">
        <div class="tab-buttons">
          <button class="tab-button" [class.active]="activeTab === 'data'" (click)="activeTab = 'data'">Datos Personales</button>
          <button class="tab-button" [class.active]="activeTab === 'password'" (click)="activeTab = 'password'">Cambiar Contraseña</button>
        </div>

        <div class="tab-content">
          <!-- Tab Datos Personales -->
          <div *ngIf="activeTab === 'data'">
            <form (ngSubmit)="saveProfile()" *ngIf="user">
              <div class="form-grid">
                <div class="form-group">
                  <label>Nombre *</label>
                  <input type="text" [(ngModel)]="user.first_name" name="first_name" required />
                </div>
                <div class="form-group">
                  <label>Apellidos *</label>
                  <input type="text" [(ngModel)]="user.last_name" name="last_name" required />
                </div>
                <div class="form-group">
                  <label>Email *</label>
                  <input type="email" [(ngModel)]="user.email" name="email" required />
                </div>
                <div class="form-group">
                  <label>Teléfono</label>
                  <input type="tel" [(ngModel)]="user.phone" name="phone" />
                </div>
                <div class="form-group">
                  <label>Username</label>
                  <input type="text" [value]="user.username" readonly />
                  <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem;">El username no se puede modificar</small>
                </div>
                <div class="form-group">
                  <label>Rol</label>
                  <input type="text" [value]="getRoleLabel(user.role)" readonly />
                </div>
              </div>
              <div style="text-align: right; margin-top: 1rem;">
                <button type="submit" class="btn btn-primary" [disabled]="saving">
                  {{ saving ? 'Guardando...' : 'Guardar Cambios' }}
                </button>
              </div>
            </form>
          </div>

          <!-- Tab Cambiar Contraseña -->
          <div *ngIf="activeTab === 'password'">
            <form (ngSubmit)="changePassword()">
              <div class="form-grid">
                <div class="form-group">
                  <label>Contraseña Actual *</label>
                  <input type="password" [(ngModel)]="passwordForm.oldPassword" name="oldPassword" required />
                </div>
                <div class="form-group">
                  <label>Nueva Contraseña *</label>
                  <input type="password" [(ngModel)]="passwordForm.newPassword" name="newPassword" required minlength="6" />
                  <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem;">Mínimo 8 caracteres</small>
                </div>
                <div class="form-group">
                  <label>Confirmar Nueva Contraseña *</label>
                  <input type="password" [(ngModel)]="passwordForm.confirmPassword" name="confirmPassword" required />
                </div>
              </div>
              <div *ngIf="passwordError" style="color: #f44336; margin-top: 1rem; padding: 0.8rem; background-color: #ffebee; border-radius: 5px;">
                {{ passwordError }}
              </div>
              <div style="text-align: right; margin-top: 1rem;">
                <button type="submit" class="btn btn-primary" [disabled]="changingPassword || passwordForm.newPassword !== passwordForm.confirmPassword">
                  {{ changingPassword ? 'Cambiando...' : 'Cambiar Contraseña' }}
                </button>
              </div>
            </form>
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
          <button class="btn btn-primary" (click)="closeModal()">Aceptar</button>
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

      .tabs {
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
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

      input {
        padding: 0.8rem;
        border: 2px solid #e0e0e0;
        border-radius: 5px;
        font-size: 1rem;
        transition: border-color 0.3s;
      }

      input:focus {
        outline: none;
        border-color: #667eea;
      }

      input[readonly] {
        background-color: #f5f5f5;
        cursor: not-allowed;
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

      .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
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
export class ProfileComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  user: User | null = null;
  originalUser: User | null = null;
  activeTab = 'data';
  saving = false;
  changingPassword = false;
  passwordError = '';

  passwordForm = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  // Modal states
  showModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'info' | 'success' | 'error' = 'info';

  ngOnInit() {
    this.loadUser();
  }

  loadUser() {
    this.auth.currentUser$.subscribe((user) => {
      if (user) {
        this.user = { ...user };
        this.originalUser = { ...user };
      }
    });
  }

  getRoleLabel(role: string): string {
    const labels: { [key: string]: string } = {
      'PATIENT': 'Paciente',
      'PROFESSIONAL': 'Profesional',
      'ADMIN': 'Administrador',
    };
    return labels[role] || role;
  }

  saveProfile() {
    if (!this.user) return;

    this.saving = true;
    const payload: Partial<User> = {
      first_name: this.user.first_name,
      last_name: this.user.last_name,
      email: this.user.email,
      phone: this.user.phone,
    };

    this.api.updateProfile(payload).subscribe({
      next: (updated) => {
        this.saving = false;
        this.user = updated;
        this.originalUser = { ...updated };
        this.auth.refreshMe().subscribe();
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = 'Perfil actualizado correctamente.';
      },
      error: (err) => {
        this.saving = false;
        console.error('Error al actualizar perfil:', err);
        let errorMsg = 'Error al actualizar el perfil.';
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
      },
    });
  }

  changePassword() {
    if (!this.passwordForm.oldPassword || !this.passwordForm.newPassword || !this.passwordForm.confirmPassword) {
      this.passwordError = 'Por favor, complete todos los campos.';
      return;
    }

    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.passwordError = 'Las contraseñas no coinciden.';
      return;
    }

    if (this.passwordForm.newPassword.length < 6) {
      this.passwordError = 'La nueva contraseña debe tener al menos 8 caracteres.';
      return;
    }

    this.passwordError = '';
    this.changingPassword = true;

    this.api.changePassword(this.passwordForm.oldPassword, this.passwordForm.newPassword).subscribe({
      next: () => {
        this.changingPassword = false;
        this.passwordForm = {
          oldPassword: '',
          newPassword: '',
          confirmPassword: '',
        };
        this.showModal = true;
        this.modalType = 'success';
        this.modalTitle = 'Éxito';
        this.modalMessage = 'Contraseña cambiada correctamente.';
      },
      error: (err) => {
        this.changingPassword = false;
        console.error('Error al cambiar contraseña:', err);
        let errorMsg = 'Error al cambiar la contraseña.';
        if (err.error && err.error.detail) {
          errorMsg = err.error.detail;
        } else if (err.error && typeof err.error === 'object') {
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
        this.passwordError = errorMsg;
      },
    });
  }

  closeModal() {
    this.showModal = false;
    this.modalTitle = '';
    this.modalMessage = '';
  }
}
