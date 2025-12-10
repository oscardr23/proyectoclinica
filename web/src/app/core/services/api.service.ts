import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Appointment,
  Equipment,
  Invoice,
  PatientProfile,
  ProfessionalProfile,
  Room,
  Service,
  User,
} from '../models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getPatients(): Observable<PatientProfile[]> {
    return this.http.get<PatientProfile[]>(`${this.baseUrl}/patients/`);
  }

  createPatient(payload: Partial<PatientProfile>): Observable<PatientProfile> {
    return this.http.post<PatientProfile>(`${this.baseUrl}/patients/`, payload);
  }

  updatePatient(id: number, payload: Partial<PatientProfile>): Observable<PatientProfile> {
    return this.http.patch<PatientProfile>(`${this.baseUrl}/patients/${id}/`, payload);
  }

  deletePatient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/patients/${id}/`);
  }

  deleteRoom(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/rooms/${id}/`);
  }

  deleteEquipment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/equipment/${id}/`);
  }

  getAppointments(params?: Record<string, string>): Observable<Appointment[]> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        httpParams = httpParams.set(key, value);
      });
    }
    return this.http.get<Appointment[]>(`${this.baseUrl}/appointments/`, {
      params: httpParams,
    });
  }

  createAppointment(payload: Partial<Appointment>): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/appointments/`, payload);
  }

  updateAppointment(id: number, payload: Partial<Appointment>) {
    return this.http.patch<Appointment>(
      `${this.baseUrl}/appointments/${id}/`,
      payload,
    );
  }

  deleteAppointment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/appointments/${id}/`);
  }

  approveAppointment(id: number) {
    return this.http.post(
      `${this.baseUrl}/appointments/${id}/approve/`,
      {},
    );
  }

  getRooms(): Observable<Room[]> {
    return this.http.get<Room[]>(`${this.baseUrl}/rooms/`);
  }

  updateRoom(id: number, payload: Partial<Room>): Observable<Room> {
    return this.http.patch<Room>(`${this.baseUrl}/rooms/${id}/`, payload);
  }

  createRoom(payload: Partial<Room>): Observable<Room> {
    return this.http.post<Room>(`${this.baseUrl}/rooms/`, payload);
  }

  getEquipment(): Observable<Equipment[]> {
    return this.http.get<Equipment[]>(`${this.baseUrl}/equipment/`);
  }

  updateEquipment(id: number, payload: Partial<Equipment>): Observable<Equipment> {
    return this.http.patch<Equipment>(`${this.baseUrl}/equipment/${id}/`, payload);
  }

  createEquipment(payload: Partial<Equipment>): Observable<Equipment> {
    return this.http.post<Equipment>(`${this.baseUrl}/equipment/`, payload);
  }

  getProfessionals(): Observable<ProfessionalProfile[]> {
    return this.http.get<ProfessionalProfile[]>(
      `${this.baseUrl}/professionals/`,
    );
  }

  getServices(): Observable<Service[]> {
    return this.http.get<Service[]>(`${this.baseUrl}/services/`);
  }

  getInvoices(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.baseUrl}/invoices/`);
  }

  getInvoice(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.baseUrl}/invoices/${id}/`);
  }

  markInvoicePaid(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/invoices/${id}/mark_paid/`, {});
  }

  createInvoice(payload: Partial<Invoice>): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.baseUrl}/invoices/`, payload);
  }

  updateInvoice(id: number, payload: Partial<Invoice>): Observable<Invoice> {
    return this.http.patch<Invoice>(`${this.baseUrl}/invoices/${id}/`, payload);
  }

  createService(payload: Partial<Service>): Observable<Service> {
    return this.http.post<Service>(`${this.baseUrl}/services/`, payload);
  }

  updateService(id: number, payload: Partial<Service>): Observable<Service> {
    return this.http.patch<Service>(`${this.baseUrl}/services/${id}/`, payload);
  }

  deleteService(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/services/${id}/`);
  }

  downloadInvoicePDF(invoiceId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/invoices/${invoiceId}/pdf/`, {
      responseType: 'blob'
    });
  }

  getBudgets(patientId?: number): Observable<any[]> {
    let url = `${this.baseUrl}/budgets/`;
    if (patientId) {
      url += `?patient_id=${patientId}`;
    }
    return this.http.get<any[]>(url);
  }

  getClinicalRecords(patientId?: number): Observable<any[]> {
    let url = `${this.baseUrl}/clinical-records/`;
    if (patientId) {
      url += `?patient_id=${patientId}`;
    }
    return this.http.get<any[]>(url);
  }

  getDocuments(patientId?: number): Observable<any[]> {
    let url = `${this.baseUrl}/documents/`;
    if (patientId) {
      url += `?patient_id=${patientId}`;
    }
    return this.http.get<any[]>(url);
  }

  // Métodos para gestión de usuarios (solo admin)
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/users/`);
  }

  createUser(payload: Partial<User>): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/users/`, payload);
  }

  updateUser(userId: number, payload: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/users/${userId}/`, payload);
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/users/${userId}/`);
  }

  changeUserRole(userId: number, role: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/${userId}/change_role/`, { role });
  }

  activateUser(userId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/${userId}/activate/`, {});
  }

  deactivateUser(userId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/${userId}/deactivate/`, {});
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/auth/change-password/`, {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  updateProfile(payload: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/auth/me/`, payload);
  }

  // Métodos para disponibilidad
  getAppointmentAvailability(professionalId?: number, date?: string): Observable<any> {
    let url = `${this.baseUrl}/appointments/availability/`;
    const params: any = {};
    if (professionalId) params.professional_id = professionalId.toString();
    if (date) params.date = date;
    return this.http.get(url, { params });
  }

  getProfessionalAvailability(professionalId: number, date: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/professionals/${professionalId}/availability/`, {
      params: { date },
    });
  }

  getRoomAvailability(roomId: number, date: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/rooms/${roomId}/availability/`, {
      params: { date },
    });
  }

  // Métodos para informes
  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/reports/dashboard/`);
  }

  getBillingReport(dateFrom?: string, dateTo?: string): Observable<any> {
    let params: any = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    return this.http.get(`${this.baseUrl}/reports/billing/`, { params });
  }

  getActivityReport(dateFrom?: string, dateTo?: string): Observable<any> {
    let params: any = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    return this.http.get(`${this.baseUrl}/reports/activity/`, { params });
  }
}

