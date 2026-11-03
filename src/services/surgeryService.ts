import { httpClient } from "./httpClient";
import type { BillingCurrency } from "@/lib/money";

export interface SurgicalCategory {
  id: string;
  name: string;
}

export interface SurgicalAct {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  unitPrice: number | null;
  currency: BillingCurrency | null;
  active: boolean;
  billingCategory?: string;
  billable: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface SurgicalPriceChange {
  id: string;
  actId: string;
  actName: string;
  previousPrice: number | null;
  previousCurrency: BillingCurrency | null;
  nextPrice: number;
  nextCurrency: BillingCurrency;
  changedAt: string;
  changedBy: string;
  changedByName?: string;
}

export interface SurgicalChange {
  id: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata: { name?: string; changes?: string[] };
  createdAt: string;
  actorName?: string;
}

export interface SurgeryStats {
  currency: BillingCurrency;
  period: { startDate: string | null; endDate: string | null };
  acts: { total: number; active: number; inactive: number; unpriced: number };
  billed: { quantity: number; amount: number };
  otherCurrencies: Array<{ currency: string; lineCount: number; amount: number }>;
  byCategory: Array<{ name: string; quantity: number; amount: number }>;
  topActs: Array<{ actId: string; name: string; categoryName: string; quantity: number; amount: number }>;
  evolution: Array<{ date: string; quantity: number; amount: number }>;
}

export interface PatientSurgeryLine {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  date: string;
  currency: string;
  billedByName?: string;
  actId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

class SurgeryService {
  private readonly basePath = "/surgery";

  listCategories() {
    return httpClient.get<SurgicalCategory[]>(`${this.basePath}/categories`);
  }

  createCategory(name: string) {
    return httpClient.post<SurgicalCategory>(`${this.basePath}/categories`, { name });
  }

  listActs(params?: Record<string, string>) {
    return httpClient.get<{ data: SurgicalAct[]; total: number; currency: BillingCurrency }>(`${this.basePath}/acts`, params);
  }

  createAct(data: { name: string; categoryId: string; description?: string; unitPrice?: number }) {
    return httpClient.post<SurgicalAct>(`${this.basePath}/acts`, data);
  }

  updateAct(id: string, data: Partial<{ name: string; categoryId: string; description: string; unitPrice: number; active: boolean }>) {
    return httpClient.patch<SurgicalAct>(`${this.basePath}/acts/${id}`, data);
  }

  priceHistory(actId?: string) {
    return httpClient.get<SurgicalPriceChange[]>(`${this.basePath}/prices`, actId ? { actId } : undefined);
  }

  changes() {
    return httpClient.get<SurgicalChange[]>(`${this.basePath}/changes`);
  }

  stats(params?: Record<string, string>) {
    return httpClient.get<SurgeryStats>(`${this.basePath}/stats`, params);
  }

  patientHistory(patientId: string) {
    return httpClient.get<PatientSurgeryLine[]>(`${this.basePath}/patients/${patientId}/history`);
  }
}

export const surgeryService = new SurgeryService();
