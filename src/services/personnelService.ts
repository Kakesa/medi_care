// ============================================
// Service de gestion du personnel
// ============================================

import { httpClient } from './httpClient';
import type { 
  Personnel, 
  CreatePersonnelData, 
  UpdatePersonnelData,
  PersonnelQueryParams,
  PaginatedResponse,
  ApiResponse
} from '@/types';

class PersonnelService {
  private readonly basePath = '/personnel';

  async getAll(params?: PersonnelQueryParams): Promise<PaginatedResponse<Personnel>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.role) queryParams.role = params.role;
    if (params?.department) queryParams.department = params.department;
    if (params?.status) queryParams.status = params.status;

    return httpClient.get<PaginatedResponse<Personnel>>(this.basePath, queryParams);
  }

  async getById(id: string): Promise<Personnel> {
    return httpClient.get<Personnel>(`${this.basePath}/${id}`);
  }

  async create(data: CreatePersonnelData): Promise<Personnel> {
    return httpClient.post<Personnel>(this.basePath, data);
  }

  async update(id: string, data: UpdatePersonnelData): Promise<Personnel> {
    return httpClient.put<Personnel>(`${this.basePath}/${id}`, data);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/${id}`);
  }

  async updateStatus(id: string, status: Personnel['status']): Promise<Personnel> {
    return httpClient.patch<Personnel>(`${this.basePath}/${id}/status`, { status });
  }

  async getDoctors(): Promise<Personnel[]> {
    return httpClient.get<Personnel[]>(`${this.basePath}/doctors`);
  }
}

export const personnelService = new PersonnelService();
