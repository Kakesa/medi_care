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

describe('Transmission des actes vers la facturation', () => {
  it('recommande un acte au tarif du catalogue et empêche le doublon', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const nurse = await createUser({ role: 'NURSE', organizationId: org.id });
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const accountant = await createUser({ role: 'ACCOUNTANT', organizationId: org.id });

    const patient = await request(app).post('/api/patients').set(bearer(admin.token)).send({
      firstName: 'Lina',
      lastName: 'Mbeki',
      dateOfBirth: '1990-04-12',
      gender: 'F',
    });
    expect(patient.status).toBe(201);
    const patientId = patient.body.id as string;

    const catalog = await request(app).get('/api/surgery/acts').set(bearer(admin.token));
    const appendectomy = catalog.body.data.find((act: { name: string }) => act.name === 'Appendicectomie');
    const priced = await request(app).patch(`/api/surgery/acts/${appendectomy.id}`).set(bearer(admin.token)).send({ unitPrice: 150 });
    expect(priced.status).toBe(200);

    const deniedAccountant = await request(app).post('/api/charges').set(bearer(accountant.token)).send({
      patientId,
      catalogKind: 'surgery',
      catalogItemId: appendectomy.id,
      quantity: 1,
      unitPrice: 1,
      idempotencyKey: 'acte-appendicite-1',
    });
    expect(deniedAccountant.status).toBe(403);

    const stranger = await request(app).post('/api/charges').set(bearer(doctor.token)).send({
      patientId,
      catalogKind: 'surgery',
      catalogItemId: appendectomy.id,
      quantity: 1,
      idempotencyKey: 'acte-appendicite-docteur',
    });
    expect(stranger.status).toBe(403);

    await Patient.updateOne({ _id: patientId }, { primaryDoctorId: doctor.user.id });
    const created = await request(app).post('/api/charges').set(bearer(doctor.token)).send({
      patientId,
      catalogKind: 'surgery',
      catalogItemId: appendectomy.id,
      quantity: 2,
      unitPrice: 1,
      idempotencyKey: 'acte-appendicite-1',
    });
    expect(created.status).toBe(201);
    expect(created.body.unitPrice).toBe(150);
    expect(created.body.total).toBe(300);
    expect(created.body.realizationStatus).toBe('recommended');
    expect(created.body.paymentStatus).toBe('draft');
    expect(created.body.prescriberName).toBe('Ada Martin');
    expect(created.body.invoiceNumber).toMatch(/^FAC-/);

    const replay = await request(app).post('/api/charges').set(bearer(doctor.token)).send({
      patientId,
      catalogKind: 'surgery',
      catalogItemId: appendectomy.id,
      quantity: 2,
      idempotencyKey: 'acte-appendicite-1',
    });
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(created.body.id);

    const duplicate = await request(app).post('/api/charges').set(bearer(nurse.token)).send({
      patientId,
      catalogKind: 'surgery',
      catalogItemId: appendectomy.id,
      quantity: 1,
      idempotencyKey: 'acte-appendicite-2',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('DUPLICATE_ACT');

    const invoices = await request(app).get('/api/billing/invoices').query({ patientId }).set(bearer(accountant.token));
    expect(invoices.status).toBe(200);
    expect(invoices.body.data).toHaveLength(1);
    expect(invoices.body.data[0].items).toHaveLength(1);
    expect(invoices.body.data[0].items[0].unitPrice).toBe(150);
    expect(invoices.body.data[0].items[0].realizationStatus).toBe('recommended');
    expect(invoices.body.data[0].items[0].prescriberName).toBe('Ada Martin');
    expect(invoices.body.data[0].total).toBe(300);

    const performed = await request(app).patch(`/api/charges/${created.body.id}`).set(bearer(doctor.token)).send({
      realizationStatus: 'performed',
    });
    expect(performed.status).toBe(200);
    expect(performed.body.realizationStatus).toBe('performed');
    expect(performed.body.unitPrice).toBe(150);
    expect(performed.body.paymentStatus).toBe('draft');

    const service = await request(app).post('/api/billing/services').set(bearer(admin.token)).send({
      code: 'CONS-GEN',
      name: 'Consultation générale',
      category: 'CONSULTATION',
      unitPrice: 40,
    });
    expect(service.status).toBe(201);
    const personnel = await request(app).post('/api/personnel').set(bearer(admin.token)).send({
      firstName: 'Ada',
      lastName: 'Martin',
      email: doctor.user.email,
      role: 'doctor',
      department: 'Médecine générale',
    });
    expect(personnel.status).toBe(201);
    const consultation = await request(app).post('/api/consultations').set(bearer(admin.token)).send({
      patientId,
      doctorId: personnel.body.id,
      diagnosis: 'Contrôle',
      billableServiceId: service.body.id,
    });
    expect(consultation.status).toBe(201);

    const listed = await request(app).get('/api/charges').query({ patientId }).set(bearer(accountant.token));
    expect(listed.body.some((row: { originModule: string; label: string; realizationStatus: string }) => row.originModule === 'consultation' && row.label === 'Consultation générale' && row.realizationStatus === 'recommended')).toBe(true);

    const completed = await request(app).patch(`/api/consultations/${consultation.body.id}/complete`).set(bearer(admin.token));
    expect(completed.status).toBe(200);
    const after = await request(app).get('/api/charges').query({ patientId }).set(bearer(admin.token));
    const consultationCharge = after.body.find((row: { originModule: string }) => row.originModule === 'consultation');
    expect(consultationCharge.realizationStatus).toBe('performed');

    const sameInvoice = await request(app).get(`/api/billing/invoices/${created.body.invoiceId}`).set(bearer(accountant.token));
    expect(sameInvoice.body.items).toHaveLength(2);
    expect(sameInvoice.body.total).toBe(340);
    expect(sameInvoice.body.status).toBe('draft');

    const cancelled = await request(app).patch(`/api/charges/${created.body.id}`).set(bearer(nurse.token)).send({
      realizationStatus: 'cancelled',
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.realizationStatus).toBe('cancelled');
    const remaining = await request(app).get(`/api/billing/invoices/${created.body.invoiceId}`).set(bearer(accountant.token));
    expect(remaining.body.items.some((item: { description: string }) => item.description === 'Appendicectomie')).toBe(false);
    expect(remaining.body.total).toBe(40);
  });
});
