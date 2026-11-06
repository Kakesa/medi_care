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
  history: Array<{ actorId: string; action: string; at: string; reason?: string }>;
}

export interface NursingVitalSigns {
  id: string;
  patientId: string;
  recordedBy: string;
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
  consultations: Array<{ date: string; doctorName: string; status: string }>;
  prescriptions: Array<{
    id: string;
    prescriberName: string;
    items: Array<{ id: string; medication: string; dosage: string; posology: string; administrationRoute?: string; instructions?: string }>;
    pharmacyStatus: string;
    validatedAt?: string;
  }>;
  exams: Array<{ id: string; name: string; type: string; date: string; status: string }>;
  care: NursingCare[];
  observations: NursingObservation[];
  vitals: NursingVitalSigns[];
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
