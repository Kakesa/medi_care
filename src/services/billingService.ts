// ============================================
// Service de facturation
// ============================================

import { httpClient } from './httpClient';
import type { 
  Invoice, 
  CreateInvoiceData, 
  UpdateInvoiceData,
  InvoiceQueryParams,
  PaginatedResponse,
  ApiResponse,
  PaymentMethod
} from '@/types';
import type { BillingCategory } from '@/lib/billingCategories';
import type { BillingCurrency } from '@/lib/money';

export interface BillableServiceRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  unitPrice: number;
  currency: BillingCurrency;
  unit: string;
  department?: string;
  active: boolean;
  effectiveFrom: string;
  billingRule?: string;
}

export interface CashMovement {
  id: string;
  at: string;
  reference: string;
  label: string;
  category: string;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  actorName: string;
  status: 'paid' | 'pending' | 'cancelled';
  statusLabel: string;
  direction: 'in' | 'out';
  source: 'invoice' | 'sale' | 'expense';
}

export interface CashflowReport {
  organization: { name: string; address: string; phone: string; email: string };
  period: { from: string; to: string };
  generatedAt: string;
  currency: BillingCurrency | string;
  entries: CashMovement[];
  exits: CashMovement[];
  pending: CashMovement[];
  cancelled: CashMovement[];
  totals: { income: number; expense: number; balance: number };
  incomeByCategory: Array<{ category: string; amount: number }>;
  expenseByCategory: Array<{ category: string; amount: number }>;
  otherCurrency: Array<{ currency: string; income: number; expense: number }>;
}

export interface BillingSettings {
  currency: BillingCurrency;
  currencies: BillingCurrency[];
  categories: BillingCategory[];
}

class BillingService {
  private readonly basePath = '/billing';

  async getSettings(): Promise<BillingSettings> {
    return httpClient.get<BillingSettings>(`${this.basePath}/settings`);
  }

  async updateSettings(currency: BillingCurrency): Promise<BillingSettings> {
    return httpClient.patch<BillingSettings>(`${this.basePath}/settings`, { currency });
  }

  async getServices(): Promise<BillableServiceRecord[]> {
    return httpClient.get<BillableServiceRecord[]>(`${this.basePath}/services`);
  }

  async createService(data: {
    code: string;
    name: string;
    category: string;
    unitPrice: number;
    unit?: string;
    department?: string;
    description?: string;
  }): Promise<BillableServiceRecord> {
    return httpClient.post<BillableServiceRecord>(`${this.basePath}/services`, data);
  }

  async updateService(id: string, data: Partial<{
    name: string;
    description: string;
    category: string;
    unitPrice: number;
    unit: string;
    department: string;
    active: boolean;
  }>): Promise<BillableServiceRecord> {
    return httpClient.patch<BillableServiceRecord>(`${this.basePath}/services/${id}`, data);
  }

  async getBillingPatients(): Promise<Array<{ id: string; firstName: string; lastName: string }>> {
    return httpClient.get(`${this.basePath}/patients`);
  }

  async getMyInvoices(): Promise<Invoice[]> {
    return httpClient.get<Invoice[]>(`${this.basePath}/my-invoices`);
  }

  async getInvoices(params?: InvoiceQueryParams): Promise<PaginatedResponse<Invoice>> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.status) queryParams.status = params.status;
    if (params?.patientId) queryParams.patientId = params.patientId;
    if (params?.startDate) queryParams.startDate = params.startDate;
    if (params?.endDate) queryParams.endDate = params.endDate;

    return httpClient.get<PaginatedResponse<Invoice>>(`${this.basePath}/invoices`, queryParams);
  }

  async getInvoiceById(id: string): Promise<Invoice> {
    return httpClient.get<Invoice>(`${this.basePath}/invoices/${id}`);
  }

  async createInvoice(data: CreateInvoiceData): Promise<Invoice> {
    return httpClient.post<Invoice>(`${this.basePath}/invoices`, data);
  }

  async updateInvoice(id: string, data: UpdateInvoiceData): Promise<Invoice> {
    return httpClient.put<Invoice>(`${this.basePath}/invoices/${id}`, data);
  }

  async deleteInvoice(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete<ApiResponse<void>>(`${this.basePath}/invoices/${id}`);
  }

  async finalizeInvoice(id: string): Promise<Invoice> {
    return httpClient.patch<Invoice>(`${this.basePath}/invoices/${id}/finalize`, {});
  }

  async markAsPaid(id: string, paymentMethod: PaymentMethod, paymentReference?: string): Promise<Invoice> {
    return httpClient.patch<Invoice>(`${this.basePath}/invoices/${id}/pay`, { paymentMethod, paymentReference });
  }

  async cancelInvoice(id: string): Promise<Invoice> {
    return httpClient.patch<Invoice>(`${this.basePath}/invoices/${id}/cancel`, {});
  }

  async getByPatient(patientId: string): Promise<Invoice[]> {
    return httpClient.get<Invoice[]>(`${this.basePath}/invoices/by-patient/${patientId}`);
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    return httpClient.get<Invoice[]>(`${this.basePath}/invoices/overdue`);
  }

  async getCashflow(from: string, to: string): Promise<CashflowReport> {
    return httpClient.get<CashflowReport>(`${this.basePath}/cashflow`, { from, to });
  }

  async getStats(): Promise<{
    totalRevenue: number;
    pendingAmount: number;
    overdueAmount: number;
    invoiceCount: number;
  }> {
    return httpClient.get(`${this.basePath}/stats`);
  }

  async generateInvoiceNumber(): Promise<string> {
    const response = await httpClient.get<{ invoiceNumber: string }>(`${this.basePath}/generate-number`);
    return response.invoiceNumber;
  }
}

export const billingService = new BillingService();
