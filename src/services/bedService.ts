import { httpClient } from './httpClient';
import type { Bed, Ward, CreateBedData, UpdateBedData, BedQueryParams, ApiResponse, PaginatedResponse } from '@/types';

export const bedService = {
  // Beds
  getAll: (params?: BedQueryParams) =>
    httpClient.get<PaginatedResponse<Bed>>('/beds', { params: params as any }),

  getById: (id: string) =>
    httpClient.get<Bed>(`/beds/${id}`),

  create: (data: CreateBedData) =>
    httpClient.post<Bed>('/beds', data),

  update: (id: string, data: UpdateBedData) =>
    httpClient.put<Bed>(`/beds/${id}`, data),

  delete: (id: string) =>
    httpClient.delete<ApiResponse<void>>(`/beds/${id}`),

  assign: (bedId: string, patientId: string, patientName: string) =>
    httpClient.put<Bed>(`/beds/${bedId}/assign`, { patientId, patientName }),

  release: (bedId: string) =>
    httpClient.put<Bed>(`/beds/${bedId}/release`, {}),

  // Wards
  getWards: () =>
    httpClient.get<Ward[]>('/wards'),

  getWardById: (id: string) =>
    httpClient.get<Ward>(`/wards/${id}`),
};
