export type Role = 'PATIENT' | 'PROFESSIONAL' | 'ADMIN';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  phone?: string;
  document_id?: string;
  is_active?: boolean;
}

export interface PatientProfile {
  id: number;
  user: User;
  date_of_birth?: string;
  allergies?: string;
  medical_notes?: string;
  emergency_contact?: string;
  insurance_provider?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProfessionalProfile {
  id: number;
  user: User;
  specialty: string;
  license_number: string;
  working_days: string;
  start_hour?: string;
  end_hour?: string;
}

export interface Room {
  id: number;
  name: string;
  description?: string;
  equipment?: any[];
  equipment_ids?: number[];
  status?: 'AVAILABLE' | 'MAINTENANCE';
  is_active: boolean;
}

export interface Equipment {
  id: number;
  name: string;
  description?: string;
  room?: number;
  room_name?: string;
  status: string;
  serial_number?: string;
  purchase_date?: string;
  last_maintenance?: string;
  is_active: boolean;
}

export interface Appointment {
  id: number;
  patient: PatientProfile;
  professional: ProfessionalProfile;
  room: Room;
  start_time: string;
  end_time: string;
  status: string;
  treatment_type: string;
  notes?: string;
  version: number;
}

export interface Service {
  id: number;
  name: string;
  description?: string;
  base_price: number;
  is_active: boolean;
}

export interface InvoiceItem {
  id: number;
  service: number;
  service_detail: Service;
  quantity: number;
  unit_price: number;
}

export interface Invoice {
  id: number;
  patient: PatientProfile;
  status: string;
  effective_status?: string; // Estado efectivo (incluye OVERDUE calculado)
  issued_at: string;
  due_date?: string;
  notes?: string;
  total: number;
  items: InvoiceItem[];
}

export interface Budget {
  id: number;
  patient: PatientProfile;
  professional: ProfessionalProfile;
  description: string;
  estimated_cost: number;
  status: string;
  created_at: string;
}

