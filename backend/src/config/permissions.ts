export const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  HOSPITAL_ADMIN: 'HOSPITAL_ADMIN',
  DOCTOR: 'DOCTOR',
  RECEPTIONIST: 'RECEPTIONIST',
  NURSE: 'NURSE',
  ACCOUNTANT: 'ACCOUNTANT',
  PHARMACIST: 'PHARMACIST',
  PATIENT: 'PATIENT',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES = Object.values(ROLES);

/** Rôles qu'un administrateur d'établissement peut attribuer. SUPERADMIN est exclu. */
export const ASSIGNABLE_ROLES = [
  ROLES.HOSPITAL_ADMIN,
  ROLES.DOCTOR,
  ROLES.RECEPTIONIST,
  ROLES.NURSE,
  ROLES.ACCOUNTANT,
  ROLES.PHARMACIST,
  ROLES.PATIENT,
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return (ALL_ROLES as string[]).includes(value);
}

export function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}
