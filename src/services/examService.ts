// ============================================
// Service de gestion des examens
// ============================================

import { httpClient } from './httpClient';
import type { 
  Exam, 
  CreateExamData, 
  UpdateExamData,
  ExamQueryParams,
  PaginatedResponse,
  ApiResponse
} from '@/types';

class ExamService {
  private readonly basePath = '/exams';

  async getAll(params?: ExamQueryParams): Promise<PaginatedResponse<Exam>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.type) queryParams.type = params.type;
    if (params?.status) queryParams.status = params.status;
    if (params?.patientId) queryParams.patientId = params.patientId;
    if (params?.doctorId) queryParams.doctorId = params.doctorId;

    return httpClient.get<PaginatedResponse<Exam>>(this.basePath, queryParams);
  }

  async getById(id: string): Promise<Exam> {
    return httpClient.get<Exam>(`${this.basePath}/${id}`);
  }

  async create(data: CreateExamData): Promise<Exam> {
    return httpClient.post<Exam>(this.basePath, data);
  }

  async update(id: string, data: UpdateExamData): Promise<Exam> {
    return httpClient.put<Exam>(`${this.basePath}/${id}`, data);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/${id}`);
  }

  async updateStatus(id: string, status: Exam['status']): Promise<Exam> {
    return httpClient.patch<Exam>(`${this.basePath}/${id}/status`, { status });
  }

  async addResults(id: string, results: string, files?: string[]): Promise<Exam> {
    return httpClient.patch<Exam>(`${this.basePath}/${id}/results`, { results, files });
  }

  async getByPatient(patientId: string): Promise<Exam[]> {
    return httpClient.get<Exam[]>(`${this.basePath}/by-patient/${patientId}`);
  }

  async getPending(): Promise<Exam[]> {
    return httpClient.get<Exam[]>(`${this.basePath}/pending`);
  }
}

export const examService = new ExamService();
