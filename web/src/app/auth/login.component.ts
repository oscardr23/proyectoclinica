import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'dc-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-wrapper">
      <section class="card">
        <h1>DentConnect</h1>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <label>
            Usuario / Email
            <input type="text" formControlName="username" placeholder="usuario@clinica.com" />
          </label>
          <label>
            Contraseña
            <input type="password" formControlName="password" placeholder="********" />
          </label>

          <button type="submit" [disabled]="form.invalid || loading">
            {{ loading ? 'Accediendo...' : 'Entrar' }}
          </button>
        </form>

        <p class="error" *ngIf="error">{{ error }}</p>
      </section>
    </div>
  `,
  styles: [
    `
      .login-wrapper {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
        padding: 1rem;
      }

      .card {
        background: white;
        padding: 2rem;
        border-radius: 1rem;
        width: min(420px, 100%);
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
      }

      label {
        display: flex;
        flex-direction: column;
        font-size: 0.875rem;
        color: #334155;
      }

      input {
        border: 1px solid #cbd5f5;
        border-radius: 0.5rem;
        padding: 0.75rem;
        font-size: 1rem;
        margin-top: 0.35rem;
      }

      button {
        border: none;
        border-radius: 0.75rem;
        background: #0ea5e9;
        color: white;
        font-weight: 600;
        font-size: 1rem;
        padding: 0.85rem;
        cursor: pointer;
      }

      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .error {
        margin-top: 1rem;
        color: #b91c1c;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  loading = false;
  error = '';

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  onSubmit() {
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
    this.error = '';
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.loading = false;
        this.error = 'Credenciales no válidas.';
      },
    });
  }
}

