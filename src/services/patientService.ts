// ============================================
// Service de gestion des patients
// ============================================

import { httpClient } from './httpClient';
import type { 
  Patient, 
  CreatePatientData, 
  UpdatePatientData,
  PatientQueryParams,
  PaginatedResponse,
  ApiResponse
} from '@/types';

class PatientService {
  private readonly basePath = '/patients';

  async getAll(params?: PatientQueryParams): Promise<PaginatedResponse<Patient>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.status) queryParams.status = params.status;
    if (params?.search) queryParams.search = params.search;

    return httpClient.get<PaginatedResponse<Patient>>(this.basePath, queryParams);
  }

  async getById(id: string): Promise<Patient> {
    return httpClient.get<Patient>(`${this.basePath}/${id}`);
  }

  async getDossier(id: string): Promise<PatientDossier> {
    return httpClient.get<PatientDossier>(`${this.basePath}/${id}/dossier`);
  }

  async create(data: CreatePatientData): Promise<Patient> {
    return httpClient.post<Patient>(this.basePath, data);
  }

  async update(id: string, data: UpdatePatientData): Promise<Patient> {
    return httpClient.put<Patient>(`${this.basePath}/${id}`, data);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/${id}`);
  }

  async updateStatus(id: string, status: Patient['status']): Promise<Patient> {
    return httpClient.patch<Patient>(`${this.basePath}/${id}/status`, { status });
  }

  async getHistory(id: string): Promise<{
    consultations: unknown[];
    exams: unknown[];
    appointments: unknown[];
  }> {
    return httpClient.get(`${this.basePath}/${id}/history`);
  }
}

export interface DossierExam {
  id: string;
  name: string;
  category?: string;
  type?: string;
  date?: string;
  status?: string;
  labStatus?: string;
  doctorName?: string;
  results?: string;
}

export interface DossierConsultation {
  id: string;
  patientId: string;
  date?: string;
  recordedAt?: string;
  doctorName: string;
  status: string;
  motif?: string;
  symptoms: string[];
  histoireMaladie?: string;
  comportementAnamnese?: string;
  examenPhysique?: string;
  diagnosis?: string;
  conclusion?: string;
  treatment?: string;
  prescription?: string;
  notes?: string;
  followUpDate?: string;
  requestedExams?: string;
  antecedent?: string;
  allergies: string[];
  exams: DossierExam[];
}

export interface PatientDossier {
  patient: Patient & { doctorName?: string };
  consultations: DossierConsultation[];
  history: {
    antecedents: { date?: string; doctorName: string; text: string }[];
    allergies: string[];
    hospitalizations: {
      id: string;
      status: string;
      ward?: string;
      room?: string;
      admittedAt?: string;
      dischargedAt?: string;
    }[];
    exams: DossierExam[];
    prescriptions: {
      id: string;
      prescriberName: string;
      createdAt?: string;
      items: { medication: string; dosage?: string; posology?: string; route?: string; duration?: string; instructions?: string }[];
    }[];
  };
}

export const patientService = new PatientService();
