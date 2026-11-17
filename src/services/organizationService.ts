import { httpClient } from './httpClient';
import type { PaginatedResponse } from '@/types';

export type OrganizationStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface OrganizationAdmin {
  id: string;
  firstName: string;
  lastName: string;
  postName?: string;
  fullName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  status: OrganizationStatus;
  plan: string;
  currency?: string;
  facilityType?: string;
  registrationNumber?: string;
  commune?: string;
  city?: string;
  province?: string;
  country?: string;
  location?: string;
  logo?: string;
  coverImage?: string;
  primaryColor?: string;
  timezone?: string;
  stamp?: string;
  rejectionReason?: string;
  submittedAt?: string;
  createdAt?: string;
  userCount?: number;
  patientCount?: number;
  admin?: OrganizationAdmin;
}

export interface OrganizationProfile {
  organization: OrganizationRecord;
  admins: OrganizationAdmin[];
  personnel: { id: string; firstName: string; lastName: string; role: string; department: string; status: string }[];
  activity: { patients: number; consultations: number; exams: number; appointments: number; personnel: number };
  history: { id: string; action: string; actorRole?: string; success: boolean; createdAt?: string; status?: string; reason?: string }[];
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
}

class OrganizationService {
  async list(params?: { search?: string; status?: OrganizationStatus }) {
    const query: Record<string, string> = { limit: '100' };
    if (params?.search) query.search = params.search;
    if (params?.status) query.status = params.status;
    return httpClient.get<PaginatedResponse<OrganizationRecord>>('/organizations', query);
  }

  async profile(id: string) {
    return httpClient.get<OrganizationProfile>(`/organizations/${id}/profile`);
  }

  async decide(id: string, decision: 'approve' | 'reject', reason?: string) {
    return httpClient.post<OrganizationRecord>(`/organizations/${id}/decision`, { decision, ...(reason ? { reason } : {}) });
  }

  async create(data: CreateOrganizationInput) {
    return httpClient.post<OrganizationRecord>('/organizations', data);
  }

  async update(id: string, data: Partial<Pick<OrganizationRecord, 'name' | 'address' | 'phone' | 'email' | 'status' | 'commune' | 'city' | 'province' | 'country' | 'timezone' | 'primaryColor'>>) {
    return httpClient.patch<OrganizationRecord>(`/organizations/${id}`, data);
  }
}

export const organizationService = new OrganizationService();
