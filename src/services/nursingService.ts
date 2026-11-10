import { httpClient } from './httpClient';
import type { MedicationAdministration, MedicationAdministrationSheet, NursingPage, NursingPatient, NursingCare, NursingDashboard, NursingPatientDetail, NursingReport, NursingThresholds, NursingVitalSigns } from '@/types/nursing';

class NursingService {
  private readonly basePath = '/nursing';

  getDashboard() {
    return httpClient.get<NursingDashboard>(`${this.basePath}/dashboard`);
  }

  getPatients(search?: string) {
    return httpClient.get<NursingPage<NursingPatient>>(`${this.basePath}/patients`, {
      limit: '100',
      ...(search ? { search } : {}),
    });
  }

  getPatient(patientId: string) {
    return httpClient.get<NursingPatientDetail>(`${this.basePath}/patients/${patientId}`);
  }

  getCare(params: { patientId?: string; date?: string } = {}) {
    return httpClient.get<NursingPage<NursingCare>>(`${this.basePath}/care`, {
      limit: '100',
      ...(params.patientId ? { patientId: params.patientId } : {}),
      ...(params.date ? { date: params.date } : {}),
    });
  }

  createCare(input: {
    patientId: string;
    type: string;
    description: string;
    scheduledAt: string;
    prescriptionId?: string;
    prescriptionItemId?: string;
  }) {
    return httpClient.post<NursingCare>(`${this.basePath}/care`, input);
  }

  updateCare(id: string, input: { status: string; observations?: string; notDoneReason?: string }) {
    return httpClient.patch<NursingCare>(`${this.basePath}/care/${id}/status`, input);
  }

  correctCare(id: string, input: {
    reason: string;
    description?: string;
    scheduledAt?: string;
    observations?: string;
  }) {
    return httpClient.post<NursingCare>(`${this.basePath}/care/${id}/corrections`, input);
  }

  getVitals(patientId: string) {
    return httpClient.get<NursingPage<NursingVitalSigns>>(`${this.basePath}/vitals`, {
      patientId,
      limit: '100',
    });
  }

  createVitals(input: Record<string, string | number | undefined>) {
    return httpClient.post<NursingVitalSigns>(`${this.basePath}/vitals`, input);
  }

  createObservation(input: { patientId: string; content: string }) {
    return httpClient.post<NursingPatientDetail['observations'][number]>(`${this.basePath}/observations`, input);
  }

  getAdministrations(patientId: string, date: string) {
    return httpClient.get<MedicationAdministrationSheet>(`${this.basePath}/administrations`, { patientId, date });
  }

  confirmAdministration(id: string, observations?: string) {
    return httpClient.post<MedicationAdministration>(`${this.basePath}/administrations/${id}/confirm`, { observations });
  }

  markAdministrationMissed(id: string, input: {
    reasonType: 'patient_absent' | 'patient_refused' | 'unavailable' | 'other';
    reason: string;
    observations?: string;
  }) {
    return httpClient.post<MedicationAdministration>(`${this.basePath}/administrations/${id}/not-administered`, input);
  }

  correctAdministration(id: string, input: { reason: string; observations?: string }) {
    return httpClient.post<MedicationAdministration>(`${this.basePath}/administrations/${id}/corrections`, input);
  }

  getSettings() {
    return httpClient.get<NursingThresholds>(`${this.basePath}/settings`);
  }

  updateSettings(settings: NursingThresholds) {
    return httpClient.patch<NursingThresholds>(`${this.basePath}/settings`, settings);
  }

  getReport() {
    return httpClient.get<NursingReport>(`${this.basePath}/reports`);
  }
}

export const nursingService = new NursingService();
