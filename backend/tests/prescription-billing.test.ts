import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Invoice } from '../src/models/Invoice.js';
import { Patient } from '../src/models/Patient.js';
import { PharmacyProduct } from '../src/models/PharmacyProduct.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

async function seedFlow() {
  const org = await createOrganization('Clinique Phase4');
  const other = await createOrganization('Autre Phase4');
  const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
  const receptionist = await createUser({ role: 'RECEPTIONIST', organizationId: org.id });
  const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
  const pharmacist = await createUser({ role: 'PHARMACIST', organizationId: org.id });
  const outsider = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: other.id });

  const patient = await request(app).post('/api/patients').set(bearer(admin.token)).send({
    firstName: 'Benoit',
    lastName: 'Mwamba',
    dateOfBirth: '1988-03-02',
    gender: 'M',
  });
  expect(patient.status).toBe(201);
  await Patient.updateOne({ _id: patient.body.id }, { primaryDoctorId: doctor.user.id });

  const tanzol = await request(app).post('/api/pharmacy/products').set(bearer(admin.token)).send({
    name: 'Tanzol',
    category: 'Antiparasitaire',
    dosage: '400 mg',
    form: 'Comprimé',
    quantity: 50,
    minStock: 2,
    unit: 'comprimé',
    price: 30,
    purchasePrice: 10,
  });
  expect(tanzol.status).toBe(201);

  const artemether = await request(app).post('/api/pharmacy/products').set(bearer(admin.token)).send({
    name: 'Artemether',
    category: 'Antipaludéen',
    dosage: '80 mg',
    form: 'Ampoule',
    quantity: 20,
    minStock: 2,
    unit: 'ampoule',
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

  return {
    org, other, admin, receptionist, doctor, pharmacist, outsider,
    patientId: patient.body.id,
    prescriptionId: draft.body.id,
    tanzolId: tanzol.body.id as string,
    artemetherId: artemether.body.id as string,
  };
}

describe('Phase 4 — pharmacie → caisse → délivrance', () => {
  it('facture, bloque la délivrance avant paiement, puis délivre partiellement après encaissement', async () => {
    const ctx = await seedFlow();

    const confirmed = await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/quote/confirm`).set(bearer(ctx.pharmacist.token)).send({});
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.billingStatus).toBe('awaiting_payment');
    expect(confirmed.body.pharmacyInvoiceId).toBeTruthy();
    expect(confirmed.body.quoteTotal).toBe(360);
    expect(confirmed.body.items[0].quantityPrescribed).toBe(2);
    expect(confirmed.body.items[1].quantityPrescribed).toBe(6);

    const invoice = await Invoice.findById(confirmed.body.pharmacyInvoiceId);
    expect(invoice?.status).toBe('pending');
    expect(invoice?.total).toBe(360);
    expect(invoice?.items).toHaveLength(2);

    const blocked = await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/dispense`).set(bearer(ctx.pharmacist.token)).send({
      itemIndex: 0,
      productId: ctx.tanzolId,
      quantity: 2,
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('PAYMENT_REQUIRED');

    const doubleConfirm = await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/quote/confirm`).set(bearer(ctx.pharmacist.token)).send({});
    expect(doubleConfirm.status).toBe(409);

    const paid = await request(app).patch(`/api/billing/invoices/${confirmed.body.pharmacyInvoiceId}/pay`).set(bearer(ctx.receptionist.token)).send({
      paymentMethod: 'cash',
      paymentReference: 'CAISSE-PHARMA-1',
    });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('paid');
    expect(paid.body.pharmacyDispenseReady).toBe(true);

    const doublePay = await request(app).patch(`/api/billing/invoices/${confirmed.body.pharmacyInvoiceId}/pay`).set(bearer(ctx.receptionist.token)).send({
      paymentMethod: 'cash',
    });
    expect(doublePay.status).toBe(200);
    expect(doublePay.body.status).toBe('paid');

    const inbox = await request(app).get('/api/prescriptions').set(bearer(ctx.pharmacist.token));
    const row = inbox.body.find((item: { id: string }) => item.id === ctx.prescriptionId);
    expect(row.billingStatus).toBe('paid');
    expect(row.dispenseAuthorizedAt).toBeTruthy();

    const stockBefore = await PharmacyProduct.findById(ctx.artemetherId);
    expect(stockBefore?.quantity).toBe(20);

    const partial = await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/dispense`).set(bearer(ctx.pharmacist.token)).send({
      itemIndex: 1,
      productId: ctx.artemetherId,
      quantity: 3,
    });
    expect(partial.status).toBe(200);
    expect(partial.body.items[1].quantityDispensed).toBe(3);
    expect(partial.body.pharmacyStatus).toBe('partial');

    const stockAfterPartial = await PharmacyProduct.findById(ctx.artemetherId);
    expect(stockAfterPartial?.quantity).toBe(17);

    const doubleClick = await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/dispense`).set(bearer(ctx.pharmacist.token)).send({
      itemIndex: 1,
      productId: ctx.artemetherId,
      quantity: 3,
    });
    expect(doubleClick.status).toBe(200);
    expect(doubleClick.body.items[1].quantityDispensed).toBe(6);

    const stockAfterFullLine = await PharmacyProduct.findById(ctx.artemetherId);
    expect(stockAfterFullLine?.quantity).toBe(14);

    const tanzolOut = await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/dispense`).set(bearer(ctx.pharmacist.token)).send({
      itemIndex: 0,
      productId: ctx.tanzolId,
      quantity: 2,
    });
    expect(tanzolOut.status).toBe(200);
    expect(tanzolOut.body.pharmacyStatus).toBe('delivered');

    const invoices = await Invoice.find({ organizationId: ctx.org.id, patientId: ctx.patientId });
    expect(invoices.filter((entry) => entry.status === 'paid')).toHaveLength(1);
    expect(invoices[0].total).toBe(360);

    const outsiderPay = await request(app).patch(`/api/billing/invoices/${confirmed.body.pharmacyInvoiceId}/pay`).set(bearer(ctx.outsider.token)).send({
      paymentMethod: 'cash',
    });
    expect(outsiderPay.status).toBe(404);
  });

  it('refuse la délivrance si le stock devient insuffisant après paiement', async () => {
    const ctx = await seedFlow();
    const confirmed = await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/quote/confirm`).set(bearer(ctx.pharmacist.token)).send({
      lines: [
        { itemId: (await request(app).get(`/api/prescriptions/${ctx.prescriptionId}/quote`).set(bearer(ctx.pharmacist.token))).body.items[0].id, quantityValidated: 2, productId: ctx.tanzolId },
        { itemId: (await request(app).get(`/api/prescriptions/${ctx.prescriptionId}/quote`).set(bearer(ctx.pharmacist.token))).body.items[1].id, quantityValidated: 6, productId: ctx.artemetherId },
      ],
    });
    expect(confirmed.status).toBe(200);

    await request(app).patch(`/api/billing/invoices/${confirmed.body.pharmacyInvoiceId}/pay`).set(bearer(ctx.receptionist.token)).send({
      paymentMethod: 'cash',
    });

    await PharmacyProduct.updateOne({ _id: ctx.tanzolId }, { quantity: 1 });
    const fail = await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/dispense`).set(bearer(ctx.pharmacist.token)).send({
      itemIndex: 0,
      productId: ctx.tanzolId,
      quantity: 2,
    });
    expect(fail.status).toBeGreaterThanOrEqual(400);
  });

  it('annule une facture non payée et isole les établissements', async () => {
    const ctx = await seedFlow();
    const confirmed = await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/quote/confirm`).set(bearer(ctx.pharmacist.token)).send({});
    expect(confirmed.status).toBe(200);

    const cancelled = await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/billing/cancel`).set(bearer(ctx.pharmacist.token)).send({
      reason: 'Patient parti sans payer',
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.billingStatus).toBe('cancelled');

    const invoice = await Invoice.findById(confirmed.body.pharmacyInvoiceId);
    expect(invoice?.status).toBe('cancelled');

    const hidden = await request(app).get('/api/prescriptions').set(bearer(ctx.outsider.token));
    expect(hidden.body.find((row: { id: string }) => row.id === ctx.prescriptionId)).toBeUndefined();
  });
});
