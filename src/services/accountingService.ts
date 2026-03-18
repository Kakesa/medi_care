import { httpClient } from './httpClient';
import type { FinancialMovement, CreateMovementData, UpdateMovementData, MovementQueryParams, ApiResponse, PaginatedResponse } from '@/types';

export const accountingService = {
  getAll: (params?: MovementQueryParams) =>
    httpClient.get<PaginatedResponse<FinancialMovement>>('/accounting/movements', { params: params as any }),

  getById: (id: string) =>
    httpClient.get<FinancialMovement>(`/accounting/movements/${id}`),

  create: (data: CreateMovementData) =>
    httpClient.post<FinancialMovement>('/accounting/movements', data),

  update: (id: string, data: UpdateMovementData) =>
    httpClient.put<FinancialMovement>(`/accounting/movements/${id}`, data),

  delete: (id: string) =>
    httpClient.delete<ApiResponse<void>>(`/accounting/movements/${id}`),

  validate: (id: string) =>
    httpClient.put<FinancialMovement>(`/accounting/movements/${id}/validate`, {}),

  cancel: (id: string) =>
    httpClient.put<FinancialMovement>(`/accounting/movements/${id}/cancel`, {}),

  getSummary: (startDate?: string, endDate?: string) =>
    httpClient.get<{ totalIncome: number; totalExpense: number; balance: number }>('/accounting/summary', {
      params: { startDate, endDate } as any,
    }),
};
