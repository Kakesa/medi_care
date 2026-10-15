import { httpClient } from './httpClient';
import type { PaginatedResponse } from '@/types';

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  status: 'active' | 'suspended';
  plan: string;
  createdAt?: string;
  userCount?: number;
  patientCount?: number;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
}

class OrganizationService {
  async list() {
    return httpClient.get<PaginatedResponse<OrganizationRecord>>('/organizations', { limit: '100' });
  }

  async create(data: CreateOrganizationInput) {
    return httpClient.post<OrganizationRecord>('/organizations', data);
  }

  async update(id: string, data: Partial<Pick<OrganizationRecord, 'name' | 'address' | 'phone' | 'email' | 'status'>>) {
    return httpClient.patch<OrganizationRecord>(`/organizations/${id}`, data);
  }
}

export const organizationService = new OrganizationService();
