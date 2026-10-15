import { httpClient } from './httpClient';
import type {
  AssignBedData,
  Bed,
  BedOccupation,
  BedQueryParams,
  CreateBedData,
  CreateWardData,
  PaginatedResponse,
  UpdateBedData,
  UpdateWardData,
  Ward,
  ApiResponse,
} from '@/types';

function queryOf(params?: BedQueryParams & { page?: number; limit?: number }) {
  const query: Record<string, string> = {};
  if (params?.page) query.page = String(params.page);
  if (params?.limit) query.limit = String(params.limit);
  if (params?.wardId) query.wardId = params.wardId;
  if (params?.status) query.status = params.status;
  if (params?.type) query.type = params.type;
  return query;
}

async function collect<T>(load: (page: number) => Promise<PaginatedResponse<T>>) {
  const first = await load(1);
  if (first.totalPages <= 1) return first.data;
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) => load(index + 2))
  );
  return [first.data, ...rest.map((page) => page.data)].flat();
}

export const bedService = {
  getAll: (params?: BedQueryParams) =>
    httpClient.get<PaginatedResponse<Bed>>('/beds', queryOf({ ...params, limit: params?.limit ?? 100 })),

  listAll: (params?: Omit<BedQueryParams, 'page' | 'limit'>) =>
    collect((page) => httpClient.get<PaginatedResponse<Bed>>('/beds', queryOf({ ...params, page, limit: 100 }))),

  getById: (id: string) =>
    httpClient.get<Bed>(`/beds/${id}`),

  create: (data: CreateBedData) =>
    httpClient.post<Bed>('/beds', data),

  update: (id: string, data: UpdateBedData) =>
    httpClient.put<Bed>(`/beds/${id}`, data),

  delete: (id: string) =>
    httpClient.delete<ApiResponse<void>>(`/beds/${id}`),

  assign: (bedId: string, data: AssignBedData) =>
    httpClient.put<Bed>(`/beds/${bedId}/assign`, data),

  release: (bedId: string) =>
    httpClient.put<Bed>(`/beds/${bedId}/release`, {}),

  listOccupations: () =>
    collect((page) => httpClient.get<PaginatedResponse<BedOccupation>>('/beds/occupations', { page: String(page), limit: '100' })),

  getWards: () =>
    httpClient.get<Ward[]>('/wards'),

  getWardById: (id: string) =>
    httpClient.get<Ward>(`/wards/${id}`),

  createWard: (data: CreateWardData) =>
    httpClient.post<Ward>('/wards', data),

  updateWard: (id: string, data: UpdateWardData) =>
    httpClient.put<Ward>(`/wards/${id}`, data),

  deleteWard: (id: string) =>
    httpClient.delete<ApiResponse<void>>(`/wards/${id}`),
};
