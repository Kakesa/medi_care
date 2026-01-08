// ============================================
// Service de gestion des consultations
// ============================================

import { httpClient } from './httpClient';
import type { 
  Consultation, 
  CreateConsultationData, 
  UpdateConsultationData,
  PaginatedResponse,
  PaginationParams,
  ApiResponse
} from '@/types';

class ConsultationService {
  private readonly basePath = '/consultations';

  async getAll(params?: PaginationParams): Promise<PaginatedResponse<Consultation>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);

    return httpClient.get<PaginatedResponse<Consultation>>(this.basePath, queryParams);
  }

  async getById(id: string): Promise<Consultation> {
    return httpClient.get<Consultation>(`${this.basePath}/${id}`);
  }

  async create(data: CreateConsultationData): Promise<Consultation> {
    return httpClient.post<Consultation>(this.basePath, data);
  }

  async update(id: string, data: UpdateConsultationData): Promise<Consultation> {
    return httpClient.put<Consultation>(`${this.basePath}/${id}`, data);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/${id}`);
  }

  async complete(id: string): Promise<Consultation> {
    return httpClient.patch<Consultation>(`${this.basePath}/${id}/complete`, {});
  }

  async getByDoctor(doctorId: string): Promise<Consultation[]> {
    return httpClient.get<Consultation[]>(`${this.basePath}/by-doctor/${doctorId}`);
  }

  async getByPatient(patientId: string): Promise<Consultation[]> {
    return httpClient.get<Consultation[]>(`${this.basePath}/by-patient/${patientId}`);
  }
}

export const consultationService = new ConsultationService();
