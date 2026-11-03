import { httpClient } from './httpClient';

export interface PrescriptionItem {
  id: string;
  medication: string;
  dosage: string;
  posology: string;
  duration: string;
  instructions: string;
  quantityPrescribed: number;
  quantityDispensed: number;
  unavailable: boolean;
  unavailableNote: string;
}

export interface PrescriptionRecord {
  id: string;
  patientId: string;
  patientName: string;
  prescriberName: string;
  examId?: string;
  items: PrescriptionItem[];
  status: 'draft' | 'validated';
  pharmacyStatus: 'new' | 'preparing' | 'partial' | 'delivered' | 'closed';
  validatedAt?: string;
  createdAt?: string;
}

export const pharmacyStatusLabels: Record<PrescriptionRecord['pharmacyStatus'], string> = {
  new: 'Nouvelle ordonnance',
  preparing: 'En préparation',
  partial: 'Partiellement délivrée',
  delivered: 'Entièrement délivrée',
  closed: 'Clôturée',
};

class PrescriptionService {
  list(patientId?: string) {
    return httpClient.get<PrescriptionRecord[]>('/prescriptions', patientId ? { patientId } : undefined);
  }

  create(data: {
    patientId: string;
    examId?: string;
    items: Array<{ medication: string; dosage: string; posology: string; duration: string; instructions?: string; quantityPrescribed: number }>;
  }) {
    return httpClient.post<PrescriptionRecord>('/prescriptions', data);
  }

  validate(id: string) {
    return httpClient.post<PrescriptionRecord>(`/prescriptions/${id}/validate`, {});
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
