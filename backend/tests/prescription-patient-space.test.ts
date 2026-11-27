import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Patient } from '../src/models/Patient.js';
import { PharmacyProduct } from '../src/models/PharmacyProduct.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

async function seedPatientFlow() {
  const org = await createOrganization('Clinique Phase5A');
  const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
  const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
  const pharmacist = await createUser({ role: 'PHARMACIST', organizationId: org.id });
  const receptionist = await createUser({ role: 'RECEPTIONIST', organizationId: org.id });
  const patientUser = await createUser({ role: 'PATIENT', organizationId: org.id });
  const otherPatientUser = await createUser({ role: 'PATIENT', organizationId: org.id });

  const patient = await request(app).post('/api/patients').set(bearer(admin.token)).send({
    firstName: 'Amina',
    lastName: 'Kabeya',
    dateOfBirth: '1995-06-12',
    gender: 'F',
  });
  expect(patient.status).toBe(201);
  await Patient.updateOne(
    { _id: patient.body.id },
    { primaryDoctorId: doctor.user.id, linkedUserId: patientUser.user.id },
  );

  const other = await request(app).post('/api/patients').set(bearer(admin.token)).send({
    firstName: 'Autre',
    lastName: 'Patient',
    dateOfBirth: '1990-01-01',
    gender: 'M',
  });
  expect(other.status).toBe(201);
  await Patient.updateOne({ _id: other.body.id }, { linkedUserId: otherPatientUser.user.id });

  const tanzol = await request(app).post('/api/pharmacy/products').set(bearer(admin.token)).send({
    name: 'Tanzol',
    category: 'Antiparasitaire',
    dosage: '400 mg',
    form: 'Comprimé',
    quantity: 40,
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
    quantity: 30,
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
    org,
    admin,
    doctor,
    pharmacist,
    receptionist,
    patientUser,
    otherPatientUser,
    patientId: patient.body.id as string,
    prescriptionId: draft.body.id as string,
    tanzolId: tanzol.body.id as string,
    artemetherId: artemether.body.id as string,
  };
}

describe('Phase 5A — espace patient ordonnances', () => {
  it('expose la prescription au patient lié, sans fuite ni accès croisé', async () => {
    const ctx = await seedPatientFlow();

    const staffOnly = await request(app).get('/api/prescriptions').set(bearer(ctx.patientUser.token));
    expect(staffOnly.status).toBe(403);

    const mineBeforeQuote = await request(app).get('/api/prescriptions/mine').set(bearer(ctx.patientUser.token));
    expect(mineBeforeQuote.status).toBe(200);
    expect(mineBeforeQuote.body).toHaveLength(1);
    expect(mineBeforeQuote.body[0].id).toBe(ctx.prescriptionId);
    expect(mineBeforeQuote.body[0].quoteIsFinal).toBe(false);
    expect(mineBeforeQuote.body[0].paymentStatus).toBe('awaiting_billing');
    expect(mineBeforeQuote.body[0].items[0]).not.toHaveProperty('analysis');
    expect(JSON.stringify(mineBeforeQuote.body)).not.toMatch(/purchasePrice|matchCandidates/i);

    const detail = await request(app).get(`/api/prescriptions/mine/${ctx.prescriptionId}`).set(bearer(ctx.patientUser.token));
    expect(detail.status).toBe(200);
    expect(detail.body.patientName).toContain('Kabeya');
    expect(detail.body.organizationName).toBeTruthy();
    expect(detail.body.amountDue).toBeGreaterThan(0);

    const strangerList = await request(app).get('/api/prescriptions/mine').set(bearer(ctx.otherPatientUser.token));
    expect(strangerList.status).toBe(200);
    expect(strangerList.body).toEqual([]);

    const strangerDetail = await request(app)
      .get(`/api/prescriptions/mine/${ctx.prescriptionId}`)
      .set(bearer(ctx.otherPatientUser.token));
    expect(strangerDetail.status).toBe(404);
  });

  it('suit devis → paiement caisse → délivrance partielle puis complète', async () => {
    const ctx = await seedPatientFlow();

    const confirmed = await request(app)
      .post(`/api/prescriptions/${ctx.prescriptionId}/quote/confirm`)
      .set(bearer(ctx.pharmacist.token))
      .send({});
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.billingStatus).toBe('awaiting_payment');

    const awaiting = await request(app)
      .get('/api/prescriptions/mine?filter=awaiting_payment')
      .set(bearer(ctx.patientUser.token));
    expect(awaiting.status).toBe(200);
    expect(awaiting.body).toHaveLength(1);
    expect(awaiting.body[0].quoteIsFinal).toBe(true);
    expect(awaiting.body[0].paymentStatusLabel).toBe('En attente de paiement');
    expect(awaiting.body[0].amountDue).toBe(360);
    expect(awaiting.body[0].amountPaid).toBe(0);
    expect(awaiting.body[0].amountRemaining).toBe(360);
    expect(awaiting.body[0].invoice?.invoiceNumber).toBeTruthy();

    const paid = await request(app)
      .patch(`/api/billing/invoices/${confirmed.body.pharmacyInvoiceId}/pay`)
      .set(bearer(ctx.receptionist.token))
      .send({ paymentMethod: 'cash', paymentReference: 'CAISSE-5A' });
    expect(paid.status).toBe(200);

    const paidView = await request(app)
      .get('/api/prescriptions/mine?filter=paid')
      .set(bearer(ctx.patientUser.token));
    expect(paidView.status).toBe(200);
    expect(paidView.body).toHaveLength(1);
    expect(paidView.body[0].paymentStatus).toBe('paid');
    expect(paidView.body[0].amountPaid).toBe(360);
    expect(paidView.body[0].amountRemaining).toBe(0);

    await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/prepare`).set(bearer(ctx.pharmacist.token)).send({});

    const partial = await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/dispense`).set(bearer(ctx.pharmacist.token)).send({
      itemIndex: 1,
      productId: ctx.artemetherId,
      quantity: 3,
    });
    expect(partial.status).toBe(200);

    const partialMine = await request(app)
      .get('/api/prescriptions/mine?filter=partial_dispense')
      .set(bearer(ctx.patientUser.token));
    expect(partialMine.body).toHaveLength(1);
    const artemetherLine = partialMine.body[0].items.find((item: { medication: string }) => /Artemether/i.test(item.medication));
    expect(artemetherLine.quantityDispensed).toBe(3);
    expect(artemetherLine.quantityRemaining).toBe(3);
    expect(artemetherLine.lineDispenseStatus).toBe('partial');

    await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/dispense`).set(bearer(ctx.pharmacist.token)).send({
      itemIndex: 1,
      productId: ctx.artemetherId,
      quantity: 3,
    });
    await request(app).post(`/api/prescriptions/${ctx.prescriptionId}/dispense`).set(bearer(ctx.pharmacist.token)).send({
      itemIndex: 0,
      productId: ctx.tanzolId,
      quantity: 2,
    });

    const delivered = await request(app)
      .get('/api/prescriptions/mine?filter=delivered')
      .set(bearer(ctx.patientUser.token));
    expect(delivered.body).toHaveLength(1);
    expect(delivered.body[0].dispenseStatus).toBe('delivered');
    expect(delivered.body[0].items.every((item: { lineDispenseStatus: string }) => item.lineDispenseStatus === 'delivered')).toBe(true);

    const stock = await PharmacyProduct.findById(ctx.artemetherId);
    expect(stock?.quantity).toBe(24);
  });

  it('signale une ordonnance annulée au patient', async () => {
    const ctx = await seedPatientFlow();
    const confirmed = await request(app)
      .post(`/api/prescriptions/${ctx.prescriptionId}/quote/confirm`)
      .set(bearer(ctx.pharmacist.token))
      .send({});
    expect(confirmed.status).toBe(200);

    const cancelled = await request(app)
      .post(`/api/prescriptions/${ctx.prescriptionId}/billing/cancel`)
      .set(bearer(ctx.pharmacist.token))
      .send({ reason: 'Annulation test 5A' });
    expect(cancelled.status).toBe(200);

    const mine = await request(app).get(`/api/prescriptions/mine/${ctx.prescriptionId}`).set(bearer(ctx.patientUser.token));
    expect(mine.status).toBe(200);
    expect(mine.body.paymentStatus).toBe('cancelled');
    expect(mine.body.paymentStatusLabel).toBe('Annulé');
    expect(mine.body.amountRemaining).toBe(0);
  });
});
