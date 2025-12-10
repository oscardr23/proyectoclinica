import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'dc-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="header">
      <h1>🦷 Sistema de Gestión Clínica Dental</h1>
      <p style="color: white;">Gestión de citas y pacientes</p>
    </div>

    <nav class="navbar">
      <ul class="nav-links">
        <li><a routerLink="/dashboard" routerLinkActive="active">Agenda</a></li>
        <li *ngIf="!isPatient()"><a routerLink="/patients" routerLinkActive="active">Pacientes</a></li>
        <li><a routerLink="/appointments" routerLinkActive="active">Citas</a></li>
        <li *ngIf="!isPatient()"><a routerLink="/services" routerLinkActive="active">Recursos</a></li>
        <li *ngIf="!isPatient() && !isProfessional()"><a routerLink="/invoices" routerLinkActive="active">Facturación</a></li>
        <li *ngIf="isAdmin()"><a routerLink="/users" routerLinkActive="active">Usuarios</a></li>
        <li><a routerLink="/profile" routerLinkActive="active">Perfil</a></li>
        <li><a (click)="logout()" style="cursor: pointer;">Cerrar sesión</a></li>
      </ul>
    </nav>

    <main class="container">
      <router-outlet />
    </main>
  `,
  styles: [
    `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1.5rem 2rem;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }

      .header h1 {
        font-size: 1.8rem;
        margin-bottom: 0.5rem;
      }

      .header p {
        opacity: 0.9;
        font-size: 0.9rem;
      }

      .navbar {
        background-color: white;
        padding: 0 2rem;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      }

      .nav-links {
        display: flex;
        list-style: none;
        gap: 2rem;
        padding: 1rem 0;
      }

      .nav-links a {
        text-decoration: none;
        color: #667eea;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 5px;
        transition: background-color 0.3s;
      }

      .nav-links a:hover,
      .nav-links a.active {
        background-color: #667eea;
        color: white;
      }

      .container {
        max-width: 1400px;
        margin: 2rem auto;
        padding: 0 2rem;
      }

      @media (max-width: 768px) {
        .nav-links {
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .container {
          padding: 0 1rem;
        }
      }
    `,
  ],
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  isPatient(): boolean {
    return this.auth.isPatient();
  }

  isProfessional(): boolean {
    return this.auth.isProfessional();
  }

  isAdmin(): boolean {
    return this.auth.isAdmin();
  }
}

