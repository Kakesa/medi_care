import { httpClient } from './httpClient';

export type LabStatus =
  | 'EN_ATTENTE'
  | 'EN_COURS'
  | 'BROUILLON'
  | 'EN_ATTENTE_VALIDATION'
  | 'CORRECTION_DEMANDEE'
  | 'VALIDE'
  | 'REJETE'
  | 'ANNULE';

export interface LabAttachment {
  name: string;
  mimeType: string;
  data?: string;
}

export interface LabExam {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  name: string;
  category: string;
  instructions: string;
  date: string;
  labStatus: LabStatus;
  official: boolean;
  results: string;
  draftResults: string;
  technicalNotes: string;
  attachments: LabAttachment[];
  versions: Array<{
    version: number;
    results: string;
    technicalNotes: string;
    submittedByName: string;
    submittedAt?: string;
    decision: string;
    decisionByName: string;
    comment: string;
  }>;
  history: Array<{ at?: string; userName: string; action: string; from: string; to: string; comment: string }>;
  paymentStatus: string;
  invoiceId?: string;
  invoiceNumber?: string;
  total?: number;
  currency?: string;
  patient?: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    phone?: string;
    allergies: string[];
  };
}

export const labStatusLabels: Record<LabStatus, string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  BROUILLON: 'Brouillon',
  EN_ATTENTE_VALIDATION: 'À valider',
  CORRECTION_DEMANDEE: 'Correction demandée',
  VALIDE: 'Validé',
  REJETE: 'Rejeté',
  ANNULE: 'Annulé',
};

class LabService {
  list(labStatus?: LabStatus) {
    return httpClient.get<LabExam[]>('/lab', labStatus ? { labStatus } : undefined);
  }

  get(id: string) {
    return httpClient.get<LabExam>(`/lab/${id}`);
  }

  order(data: {
    patientId: string;
    doctorId: string;
    instructions?: string;
    items: Array<{ kind: 'surgery' | 'service'; catalogItemId: string; name: string; category: string }>;
  }) {
    return httpClient.post<{ exams: Array<LabExam & { billed: boolean }>; invoiceId?: string; invoiceNumber?: string }>('/lab/orders', data);
  }

  start(id: string) {
    return httpClient.post<LabExam>(`/lab/${id}/start`, {});
  }

  draft(id: string, data: { results: string; technicalNotes?: string; attachments?: LabAttachment[] }) {
    return httpClient.post<LabExam>(`/lab/${id}/draft`, data);
  }

  submit(id: string) {
    return httpClient.post<LabExam>(`/lab/${id}/submit`, {});
  }

  validate(id: string, comment?: string) {
    return httpClient.post<LabExam>(`/lab/${id}/validate`, { comment });
  }

  correction(id: string, comment: string) {
    return httpClient.post<LabExam>(`/lab/${id}/correction`, { comment });
  }

  reject(id: string, comment: string) {
    return httpClient.post<LabExam>(`/lab/${id}/reject`, { comment });
  }

  cancel(id: string) {
    return httpClient.post<LabExam>(`/lab/${id}/cancel`, {});
  }
}

export const labService = new LabService();
