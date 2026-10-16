import type { UserRole } from '../config/permissions.js';
import { ROLES } from '../config/permissions.js';

export const PHARMACY_PERMISSIONS = {
  STOCK_VIEW: 'pharmacy.stock.view',
  STOCK_RECEIVE: 'pharmacy.stock.receive',
  STOCK_ADJUST_REQUEST: 'pharmacy.stock.adjust.request',
  STOCK_ADJUST_APPROVE: 'pharmacy.stock.adjust.approve',
  PRODUCTS_MANAGE: 'pharmacy.products.manage',
  PURCHASE_REQUEST: 'pharmacy.purchase.request',
  PURCHASE_APPROVE: 'pharmacy.purchase.approve',
  SALES_CREATE: 'pharmacy.sales.create',
  SUPPLIERS_VIEW: 'pharmacy.suppliers.view',
  SUPPLIERS_MANAGE: 'pharmacy.suppliers.manage',
  EXPENSES_SUBMIT: 'pharmacy.expenses.submit',
  EXPENSES_VIEW: 'pharmacy.expenses.view',
  EXPENSES_APPROVE: 'pharmacy.expenses.approve',
  EXPENSES_PAY: 'pharmacy.expenses.pay',
  BUDGET_VIEW: 'pharmacy.budget.view',
  BUDGET_MANAGE: 'pharmacy.budget.manage',
  REPORTS_OPERATIONS: 'pharmacy.reports.operations',
  REPORTS_FINANCIAL: 'pharmacy.reports.financial',
} as const;

export type PharmacyPermission = (typeof PHARMACY_PERMISSIONS)[keyof typeof PHARMACY_PERMISSIONS];

const PHARMACIST_PERMISSIONS: PharmacyPermission[] = [
  PHARMACY_PERMISSIONS.STOCK_VIEW,
  PHARMACY_PERMISSIONS.STOCK_RECEIVE,
  PHARMACY_PERMISSIONS.STOCK_ADJUST_REQUEST,
  PHARMACY_PERMISSIONS.PURCHASE_REQUEST,
  PHARMACY_PERMISSIONS.SALES_CREATE,
  PHARMACY_PERMISSIONS.SUPPLIERS_VIEW,
  PHARMACY_PERMISSIONS.EXPENSES_SUBMIT,
  PHARMACY_PERMISSIONS.REPORTS_OPERATIONS,
];

const ALL_PERMISSIONS = Object.values(PHARMACY_PERMISSIONS);

export function pharmacyPermissionsFor(role: UserRole | string): PharmacyPermission[] {
  if (role === ROLES.HOSPITAL_ADMIN) return [...ALL_PERMISSIONS];
  if (role === ROLES.PHARMACIST) return [...PHARMACIST_PERMISSIONS];
  return [];
}

export function hasPharmacyPermission(role: UserRole | string, required: PharmacyPermission[]) {
  const granted = pharmacyPermissionsFor(role);
  return required.every((permission) => granted.includes(permission));
}
