// ============================================
// Service de gestion de la réception
// ============================================

import { httpClient } from './httpClient';
import type { 
  Reception, 
  CreateReceptionData, 
  UpdateReceptionData,
  PaginatedResponse,
  PaginationParams,
  ApiResponse
} from '@/types';

class ReceptionService {
  private readonly basePath = '/reception';

  async getQueue(params?: PaginationParams): Promise<PaginatedResponse<Reception>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);

    return httpClient.get<PaginatedResponse<Reception>>(this.basePath, queryParams);
  }

  async getById(id: string): Promise<Reception> {
    return httpClient.get<Reception>(`${this.basePath}/${id}`);
  }

  async registerArrival(data: CreateReceptionData): Promise<Reception> {
    return httpClient.post<Reception>(this.basePath, data);
  }

  async update(id: string, data: UpdateReceptionData): Promise<Reception> {
    return httpClient.put<Reception>(`${this.basePath}/${id}`, data);
  }

  async updateStatus(id: string, status: Reception['status']): Promise<Reception> {
    return httpClient.patch<Reception>(`${this.basePath}/${id}/status`, { status });
  }

  async assignDoctor(id: string, doctorId: string): Promise<Reception> {
    return httpClient.patch<Reception>(`${this.basePath}/${id}/assign`, { doctorId });
  }

  async cancel(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/${id}`);
  }

  async getWaiting(): Promise<Reception[]> {
    return httpClient.get<Reception[]>(`${this.basePath}/waiting`);
  }

  async getTodayStats(): Promise<{
    waiting: number;
    inConsultation: number;
    completed: number;
    cancelled: number;
  }> {
    return httpClient.get(`${this.basePath}/stats/today`);
  }
}

export const receptionService = new ReceptionService();
