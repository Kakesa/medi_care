import { httpClient } from './httpClient';

export interface PrescriptionLineAnalysis {
  rawText: string;
  medicationName: string;
  dosageAmount: number | null;
  dosageUnit: string;
  form: string;
  formUnit: string;
  quantityMarked: number | null;
  dosePerDay: number | null;
  durationDays: number | null;
  quantityFromPosology: number | null;
  quantityProposed: number | null;
  quantityValidated: number | null;
  posologyText: string;
  instructions: string;
  confidence: 'high' | 'medium' | 'low';
  needsPharmacistValidation: boolean;
  alerts: Array<{ code: string; message: string }>;
  matchedProductId: string | null;
  matchedProductName: string;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  matchCandidates: Array<{ id: string; name: string }>;
  unitPrice: number | null;
  lineTotal: number | null;
  billable: boolean;
  validationStatus: 'pending' | 'approved' | 'rejected' | 'needs_review';
  analyzedAt?: string | null;
}

export interface PrescriptionItem {
  id: string;
  medication: string;
  dosage: string;
  posology: string;
  administrationRoute?: string;
  form?: string;
  frequency?: string;
  duration: string;
  treatmentStartDate?: string;
  treatmentEndDate?: string;
  administrationTimes: string[];
  treatmentStatus: 'active' | 'suspended' | 'completed' | 'interrupted';
  treatmentStatusHistory: Array<{ status: string; changedAt: string; changedBy: string; reason: string }>;
  actualTreatmentEndAt?: string;
  instructions: string;
  quantityPrescribed: number;
  quantityDispensed: number;
  unavailable: boolean;
  unavailableNote: string;
  analysis?: PrescriptionLineAnalysis;
}

export interface PrescriptionRecord {
  id: string;
  patientId: string;
  patientName: string;
  prescriberName: string;
  examId?: string;
  consultationId?: string;
  recommendations?: string;
  items: PrescriptionItem[];
  status: 'draft' | 'validated';
  pharmacyStatus: 'new' | 'preparing' | 'partial' | 'delivered' | 'closed';
  quoteStatus?: 'none' | 'pending_review' | 'ready' | 'partial';
  quoteTotal?: number;
  quoteCurrency?: string;
  quotePendingLines?: number;
  quotedAt?: string;
  billingStatus?: 'none' | 'quoted' | 'awaiting_invoice' | 'invoiced' | 'awaiting_payment' | 'paid' | 'cancelled';
  pharmacyInvoiceId?: string;
  pharmacyInvoiceNumber?: string;
  dispenseAuthorizedAt?: string;
  pharmacyPaidAt?: string;
  validatedAt?: string;
  createdAt?: string;
}

export const billingStatusLabels: Record<NonNullable<PrescriptionRecord['billingStatus']>, string> = {
  none: 'Non facturé',
  quoted: 'Devis prêt',
  awaiting_invoice: 'Facturation…',
  invoiced: 'Facturé',
  awaiting_payment: 'En attente de paiement',
  paid: 'Payé — à délivrer',
  cancelled: 'Annulé',
};

export const pharmacyStatusLabels: Record<PrescriptionRecord['pharmacyStatus'], string> = {
  new: 'Nouvelle ordonnance',
  preparing: 'En préparation',
  partial: 'Partiellement délivrée',
  delivered: 'Entièrement délivrée',
  closed: 'Clôturée',
};

export type PharmacyAbbreviationItem = {
  code: string;
  meaning: string;
  kind: string;
  unit: string;
  variants: string[];
  active: boolean;
};

export type PrescriptionParsePreview = {
  rawText: string;
  medicationName: string;
  dosage: { amount: number | null; unit: string; raw: string };
  form: string;
  formUnit: string;
  quantityMarked: number | null;
  dosePerDay: number | null;
  durationDays: number | null;
  quantityFromPosology: number | null;
  quantityProposed: number | null;
  posologyText: string;
  instructions: string;
  confidence: 'high' | 'medium' | 'low';
  needsPharmacistValidation: boolean;
  alerts: Array<{ code: string; message: string }>;
};

class PrescriptionService {
  list(query?: { patientId?: string; consultationId?: string }) {
    return httpClient.get<PrescriptionRecord[]>('/prescriptions', query);
  }

  listAbbreviations() {
    return httpClient.get<{ items: PharmacyAbbreviationItem[] }>('/prescriptions/abbreviations');
  }

  parseLine(data: {
    rawText?: string;
    medication?: string;
    dosage?: string;
    posology?: string;
    duration?: string;
    quantityPrescribed?: number;
    instructions?: string;
  }) {
    return httpClient.post<{ parsed: PrescriptionParsePreview }>('/prescriptions/parse-line', data);
  }

  saveForConsultation(data: {
    consultationId: string;
    recommendations?: string;
    items: Array<{ medication: string; dosage: string; posology: string; administrationRoute?: string; form?: string; frequency?: string; duration: string; instructions?: string; quantityPrescribed: number }>;
  }) {
    return httpClient.post<PrescriptionRecord | { cleared: true }>('/prescriptions/consultation', data);
  }

  create(data: {
    patientId: string;
    examId?: string;
    items: Array<{ medication: string; dosage: string; posology: string; administrationRoute?: string; duration: string; treatmentStartDate?: string; treatmentEndDate?: string; administrationTimes?: string[]; instructions?: string; quantityPrescribed: number }>;
  }) {
    return httpClient.post<PrescriptionRecord>('/prescriptions', data);
  }

  validate(id: string) {
    return httpClient.post<PrescriptionRecord>(`/prescriptions/${id}/validate`, {});
  }

  getQuote(id: string) {
    return httpClient.get<PrescriptionRecord>(`/prescriptions/${id}/quote`);
  }

  refreshQuote(id: string) {
    return httpClient.post<PrescriptionRecord>(`/prescriptions/${id}/quote/refresh`, {});
  }

  confirmQuote(id: string, data?: { lines?: Array<{ itemId: string; quantityValidated: number; productId?: string }> }) {
    return httpClient.post<PrescriptionRecord>(`/prescriptions/${id}/quote/confirm`, data || {});
  }

  cancelBilling(id: string, data?: { reason?: string }) {
    return httpClient.post<PrescriptionRecord>(`/prescriptions/${id}/billing/cancel`, data || {});
  }

  updateItemStatus(id: string, itemId: string, data: { status: 'active' | 'suspended' | 'completed' | 'interrupted'; reason: string }) {
    return httpClient.patch<PrescriptionRecord>(`/prescriptions/${id}/items/${itemId}/status`, data);
  }

  prepare(id: string) {
    return httpClient.post<PrescriptionRecord>(`/prescriptions/${id}/prepare`, {});
  }

  dispense(id: string, data: { itemIndex: number; productId: string; quantity: number }) {
    return httpClient.post<PrescriptionRecord>(`/prescriptions/${id}/dispense`, data);
  }

  unavailable(id: string, data: { itemIndex: number; note: string }) {
    return httpClient.post<PrescriptionRecord>(`/prescriptions/${id}/unavailable`, data);
  }

  close(id: string) {
    return httpClient.post<PrescriptionRecord>(`/prescriptions/${id}/close`, {});
  }
}

export const prescriptionService = new PrescriptionService();
