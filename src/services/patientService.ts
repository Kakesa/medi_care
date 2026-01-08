// ============================================
// Service de gestion des patients
// ============================================

import { httpClient } from './httpClient';
import type { 
  Patient, 
  CreatePatientData, 
  UpdatePatientData,
  PatientQueryParams,
  PaginatedResponse,
  ApiResponse
} from '@/types';

class PatientService {
  private readonly basePath = '/patients';

  async getAll(params?: PatientQueryParams): Promise<PaginatedResponse<Patient>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.status) queryParams.status = params.status;
    if (params?.search) queryParams.search = params.search;

    return httpClient.get<PaginatedResponse<Patient>>(this.basePath, queryParams);
  }

  async getById(id: string): Promise<Patient> {
    return httpClient.get<Patient>(`${this.basePath}/${id}`);
  }

  async create(data: CreatePatientData): Promise<Patient> {
    return httpClient.post<Patient>(this.basePath, data);
  }

  async update(id: string, data: UpdatePatientData): Promise<Patient> {
    return httpClient.put<Patient>(`${this.basePath}/${id}`, data);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/${id}`);
  }

  async updateStatus(id: string, status: Patient['status']): Promise<Patient> {
    return httpClient.patch<Patient>(`${this.basePath}/${id}/status`, { status });
  }

  async getHistory(id: string): Promise<{
    consultations: unknown[];
    exams: unknown[];
    appointments: unknown[];
  }> {
    return httpClient.get(`${this.basePath}/${id}/history`);
  }
}

export const patientService = new PatientService();
