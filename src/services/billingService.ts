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

class BillingService {
  private readonly basePath = '/billing';

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

  async markAsPaid(id: string, paymentMethod: PaymentMethod): Promise<Invoice> {
    return httpClient.patch<Invoice>(`${this.basePath}/invoices/${id}/pay`, { paymentMethod });
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
