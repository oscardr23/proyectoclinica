import { Routes } from '@angular/router';

import { LoginComponent } from './auth/login.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { ShellComponent } from './layout/shell.component';
import { AppointmentsComponent } from './pages/appointments/appointments.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { InvoicesComponent } from './pages/invoices/invoices.component';
import { PatientsComponent } from './pages/patients/patients.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { ServicesComponent } from './pages/services/services.component';
import { UsersComponent } from './pages/users/users.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'appointments', component: AppointmentsComponent },
      { path: 'patients', component: PatientsComponent, canActivate: [roleGuard(['ADMIN', 'PROFESSIONAL'])] },
      { path: 'services', component: ServicesComponent, canActivate: [roleGuard(['ADMIN', 'PROFESSIONAL'])] },
      { path: 'invoices', component: InvoicesComponent, canActivate: [roleGuard(['ADMIN'])] },
      { path: 'users', component: UsersComponent, canActivate: [roleGuard(['ADMIN'])] },
      { path: 'profile', component: ProfileComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
