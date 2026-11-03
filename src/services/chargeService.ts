import { httpClient } from "./httpClient";

export type RealizationStatus = "recommended" | "pending" | "performed" | "cancelled";

export interface CatalogOption {
  id: string;
  kind: "surgery" | "service";
  name: string;
  category: string;
  categoryLabel: string;
  description: string;
  unitPrice: number;
  unit: string;
  currency: string;
}

export interface PatientChargeRecord {
  id: string;
  patientId: string;
  patientName: string;
  originModule: string;
  label: string;
  detail: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
  currency: string;
  prescriberName: string;
  prescribedAt: string;
  realizationStatus: RealizationStatus;
  paymentStatus: string;
  invoiceId?: string;
  invoiceNumber?: string;
  history: Array<{ at: string; actorName: string; action: string; note: string }>;
}

class ChargeService {
  catalog() {
    return httpClient.get<{ currency: string; items: CatalogOption[] }>("/charges/catalog");
  }

  list(patientId?: string) {
    const query: Record<string, string> = {};
    if (patientId) query.patientId = patientId;
    return httpClient.get<PatientChargeRecord[]>("/charges", query);
  }

  recommend(data: {
    patientId: string;
    catalogKind: "surgery" | "service";
    catalogItemId: string;
    quantity: number;
    idempotencyKey: string;
  }) {
    return httpClient.post<PatientChargeRecord>("/charges", data);
  }

  update(id: string, data: { realizationStatus?: RealizationStatus; quantity?: number }) {
    return httpClient.patch<PatientChargeRecord>(`/charges/${id}`, data);
  }
}

export const chargeService = new ChargeService();
