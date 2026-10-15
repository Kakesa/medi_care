import type { UserRole } from '@/types';

export const roleLabels: Record<UserRole, string> = {
  SUPERADMIN: 'Super administrateur',
  HOSPITAL_ADMIN: 'Administrateur',
  DOCTOR: 'Médecin',
  RECEPTIONIST: 'Réceptionniste',
  NURSE: 'Infirmier(ère)',
  ACCOUNTANT: 'Comptable',
  PHARMACIST: 'Pharmacien(ne)',
  PATIENT: 'Patient',
};

export const clinicalRoles: UserRole[] = [
  'HOSPITAL_ADMIN',
  'DOCTOR',
  'RECEPTIONIST',
  'NURSE',
  'ACCOUNTANT',
  'PHARMACIST',
  'PATIENT',
];
