import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Patient } from '../src/models/Patient.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('Quote d’ordonnance (Phase 2)', () => {
  it('persiste l’analyse, le matching et le total à la validation', async () => {
    const org = await createOrganization('Clinique Quote');
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const pharmacist = await createUser({ role: 'PHARMACIST', organizationId: org.id });

    const patient = await request(app).post('/api/patients').set(bearer(admin.token)).send({
      firstName: 'Amina',
      lastName: 'Kabila',
      dateOfBirth: '1992-01-10',
      gender: 'F',
    });
    expect(patient.status).toBe(201);
    await Patient.updateOne({ _id: patient.body.id }, { primaryDoctorId: doctor.user.id });

    const tanzol = await request(app).post('/api/pharmacy/products').set(bearer(admin.token)).send({
      name: 'Tanzol',
      genericName: 'Albendazole',
      category: 'Antiparasitaire',
      dosage: '400 mg',
      form: 'Comprimé',
      quantity: 80,
      minStock: 5,
      unit: 'comprimé',
      saleUnit: 'comprimé',
      price: 30,
      purchasePrice: 10,
    });
    expect(tanzol.status).toBe(201);

    const artemether = await request(app).post('/api/pharmacy/products').set(bearer(admin.token)).send({
      name: 'Artemether',
      category: 'Antipaludéen',
      dosage: '80 mg',
      form: 'Ampoule',
      quantity: 40,
      minStock: 2,
      unit: 'ampoule',
      saleUnit: 'ampoule',
      price: 50,
      purchasePrice: 20,
    });
    expect(artemether.status).toBe(201);

    const draft = await request(app).post('/api/prescriptions').set(bearer(doctor.token)).send({
      patientId: patient.body.id,
      items: [
        {
          medication: 'Tanzol Cés 400mg Dr 2',
          dosage: '1cé /j après 72h',
          posology: '1cé /j après 72h',
          duration: 'Selon prescription',
          quantityPrescribed: 1,
        },
        {
          medication: 'Artemether Amp 80 mg DR 5',
          dosage: '2 amps/j || 3j',
          posology: '2 amps/j || 3j',
          duration: '3j',
          quantityPrescribed: 1,
        },
      ],
    });
    expect(draft.status).toBe(201);

    const validated = await request(app).post(`/api/prescriptions/${draft.body.id}/validate`).set(bearer(doctor.token));
    expect(validated.status).toBe(200);
    expect(validated.body.quotedAt).toBeTruthy();
    expect(validated.body.quoteStatus).toBe('partial');
    expect(validated.body.quoteTotal).toBe(360);
    expect(validated.body.quotePendingLines).toBe(1);

    const tanzolLine = validated.body.items[0];
    expect(tanzolLine.quantityPrescribed).toBe(2);
    expect(tanzolLine.analysis.matchedProductId).toBe(tanzol.body.id);
    expect(tanzolLine.analysis.quantityProposed).toBe(2);
    expect(tanzolLine.analysis.unitPrice).toBe(30);
    expect(tanzolLine.analysis.lineTotal).toBe(60);
    expect(tanzolLine.analysis.billable).toBe(true);

    const artemetherLine = validated.body.items[1];
    expect(artemetherLine.quantityPrescribed).toBe(6);
    expect(artemetherLine.analysis.matchedProductId).toBe(artemether.body.id);
    expect(artemetherLine.analysis.quantityMarked).toBe(5);
    expect(artemetherLine.analysis.quantityFromPosology).toBe(6);
    expect(artemetherLine.analysis.quantityProposed).toBe(6);
    expect(artemetherLine.analysis.lineTotal).toBe(300);
    expect(artemetherLine.analysis.needsPharmacistValidation).toBe(true);
    expect(artemetherLine.analysis.billable).toBe(false);
    expect(artemetherLine.analysis.alerts.some((alert: { code: string; message: string }) =>
      alert.code === 'quantity_ambiguous' && alert.message.toLowerCase().includes('ne correspond pas'),
    )).toBe(true);

    const quote = await request(app).get(`/api/prescriptions/${draft.body.id}/quote`).set(bearer(pharmacist.token));
    expect(quote.status).toBe(200);
    expect(quote.body.quoteTotal).toBe(360);

    const refreshed = await request(app).post(`/api/prescriptions/${draft.body.id}/quote/refresh`).set(bearer(pharmacist.token));
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.quoteTotal).toBe(360);
    expect(refreshed.body.history.some((entry: { action: string }) => entry.action === 'QUOTE_REFRESH')).toBe(true);
  });
});
