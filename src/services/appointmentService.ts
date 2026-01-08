// ============================================
// Service de gestion des rendez-vous
// ============================================

import { httpClient } from './httpClient';
import type { 
  Appointment, 
  CreateAppointmentData, 
  UpdateAppointmentData,
  AppointmentQueryParams,
  PaginatedResponse,
  ApiResponse
} from '@/types';

class AppointmentService {
  private readonly basePath = '/appointments';

  async getAll(params?: AppointmentQueryParams): Promise<PaginatedResponse<Appointment>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.date) queryParams.date = params.date;
    if (params?.doctorId) queryParams.doctorId = params.doctorId;
    if (params?.patientId) queryParams.patientId = params.patientId;
    if (params?.status) queryParams.status = params.status;

    return httpClient.get<PaginatedResponse<Appointment>>(this.basePath, queryParams);
  }

  async getById(id: string): Promise<Appointment> {
    return httpClient.get<Appointment>(`${this.basePath}/${id}`);
  }

  async create(data: CreateAppointmentData): Promise<Appointment> {
    return httpClient.post<Appointment>(this.basePath, data);
  }

  async update(id: string, data: UpdateAppointmentData): Promise<Appointment> {
    return httpClient.put<Appointment>(`${this.basePath}/${id}`, data);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/${id}`);
  }

  async updateStatus(id: string, status: Appointment['status']): Promise<Appointment> {
    return httpClient.patch<Appointment>(`${this.basePath}/${id}/status`, { status });
  }

  async getByDate(date: string): Promise<Appointment[]> {
    return httpClient.get<Appointment[]>(`${this.basePath}/by-date/${date}`);
  }

  async getByDoctor(doctorId: string): Promise<Appointment[]> {
    return httpClient.get<Appointment[]>(`${this.basePath}/by-doctor/${doctorId}`);
  }

  async getByPatient(patientId: string): Promise<Appointment[]> {
    return httpClient.get<Appointment[]>(`${this.basePath}/by-patient/${patientId}`);
  }
}

export const appointmentService = new AppointmentService();
