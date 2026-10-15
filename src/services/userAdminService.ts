import { httpClient } from './httpClient';
import type { PaginatedResponse, User, UserRole } from '@/types';

export type AssignableRole = Exclude<UserRole, 'SUPERADMIN'>;

export interface CreateStaffInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password?: string;
  role: AssignableRole;
}

class UserAdminService {
  async list() {
    return httpClient.get<PaginatedResponse<User>>('/users', { limit: '100' });
  }

  async create(data: CreateStaffInput) {
    return httpClient.post<User>('/users', data);
  }

  async createForOrganization(organizationId: string, data: CreateStaffInput) {
    return httpClient.post<User>(`/organizations/${organizationId}/users`, data);
  }

  async updateRole(id: string, role: AssignableRole) {
    return httpClient.patch<User>(`/users/${id}/role`, { role });
  }

  async updateStatus(id: string, isActive: boolean) {
    return httpClient.patch<User>(`/users/${id}/status`, { isActive });
  }
}

export const userAdminService = new UserAdminService();
