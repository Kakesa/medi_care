import type { PaginatedResponse } from './index';

export type NursingCareType =
  | 'medication'
  | 'injection'
  | 'infusion'
  | 'dressing'
  | 'sample'
  | 'monitoring'
  | 'hygiene'
  | 'assistance'
  | 'other';

export type NursingCareStatus = 'pending' | 'in_progress' | 'completed' | 'not_done' | 'cancelled';

export interface NursingCare {
  id: string;
  patientId: string;
  nurseId: string;
  type: NursingCareType;
  description: string;
  prescriptionId?: string;
  prescriptionItemId?: string;
  medication?: string;
  prescribedDose?: string;
  administrationRoute?: string;
  scheduledAt: string;
  performedAt?: string;
  status: NursingCareStatus;
  observations?: string;
  notDoneReason?: string;
  history: Array<{
    actorId: string;
    action: string;
    at: string;
    reason?: string;
    changes?: Record<string, { from: unknown; to: unknown }>;
  }>;
}

export interface NursingVitalSigns {
  id: string;
  patientId: string;
  recordedBy: string;
  recordedByName?: string;
  measuredAt: string;
  systolic?: number;
  diastolic?: number;
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  glucose?: number;
  observation?: string;
  alerts: string[];
}

export interface NursingPatient {
  id: string;
  recordNumber: string;
  firstName: string;
  lastName: string;
  age?: number;
  status: 'hospitalized' | 'outpatient';
  room?: string;
  ward?: string;
  doctor?: string;
  primaryDoctorId?: string;
  lastVitals?: NursingVitalSigns | { temperature?: number; tension?: string; oxygenSaturation?: number };
  nextCare?: Pick<NursingCare, 'id' | 'type' | 'description' | 'scheduledAt' | 'status'>;
}

export interface NursingDashboard {
  stats: {
    patientsUnderSurveillance: number;
    careToPerform: number;
    careCompletedToday: number;
    overdueCare: number;
    prescriptionsWaiting: number;
    patientsRequiringAttention: number;
  };
  patients: NursingPatient[];
  dueItems: NursingCare[];
  alertDisclaimer: string;
}

export interface NursingObservation {
  id: string;
  nurseId: string;
  nurseName?: string;
  observedAt: string;
  content: string;
}

export interface NursingPatientDetail {
  patient: NursingPatient & {
    dateOfBirth?: string;
    gender?: string;
    allergies?: string[];
    bloodType?: string;
  };
  hospitalization?: {
    status: 'active' | 'completed';
    admittedAt: string;
    dischargedAt?: string;
    expectedDischargeAt?: string;
    durationDays: number;
    ward?: string;
    room?: string;
  };
  consultations: Array<{ date: string; doctorName: string; diagnosis?: string; status: string }>;
  prescriptions: Array<{
    id: string;
    prescriberName: string;
    items: Array<{
      id: string; medication: string; dosage: string; posology: string;
      administrationRoute?: string; duration: string; treatmentStartDate?: string;
      treatmentEndDate?: string; administrationTimes?: string[]; instructions?: string;
      treatmentStatus?: 'active' | 'suspended' | 'completed' | 'interrupted'; actualTreatmentEndAt?: string;
    }>;
    pharmacyStatus: string;
    validatedAt?: string;
  }>;
  exams: Array<{ id: string; name: string; type: string; date: string; status: string }>;
  care: NursingCare[];
  observations: NursingObservation[];
  vitals: NursingVitalSigns[];
}

export type MedicationAdministrationStatus =
  | 'pending'
  | 'administered_on_time'
  | 'administered_late'
  | 'not_administered'
  | 'patient_refused'
  | 'suspended'
  | 'treatment_completed'
  | 'treatment_interrupted';

export interface MedicationAdministration {
  id: string;
  patientId: string;
  prescriptionId: string;
  prescriptionItemId: string;
  medication: string;
  prescribedDose: string;
  administrationRoute: string;
  posology: string;
  instructions: string;
  scheduledAt: string;
  administeredAt?: string;
  administeredBy?: string;
  administeredByName?: string;
  status: MedicationAdministrationStatus;
  observations?: string;
  notDoneReason?: string;
  history: Array<{ actorId: string; action: string; at: string; reason?: string }>;
}

export interface MedicationAdministrationSheet {
  patientId: string;
  date: string;
  timeZone: string;
  lateWindowMinutes: number;
  doses: MedicationAdministration[];
  unconfiguredItems: Array<{ prescriptionId: string; medication: string; reason: string }>;
}

export type NursingThresholds = {
  systolicMin: number;
  systolicMax: number;
  diastolicMin: number;
  diastolicMax: number;
  temperatureMin: number;
  temperatureMax: number;
  heartRateMin: number;
  heartRateMax: number;
  respiratoryRateMin: number;
  respiratoryRateMax: number;
  oxygenSaturationMin: number;
  glucoseMin: number;
  glucoseMax: number;
};

export interface NursingReport {
  totalCare: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  observations: number;
  vitalMeasurements: number;
  period: { from?: string; to?: string };
}

export type NursingPage<T> = PaginatedResponse<T>;
