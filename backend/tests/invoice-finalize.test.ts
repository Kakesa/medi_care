import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('Finalisation de facture', () => {
  it('verrouille le brouillon et n’autorise l’encaissement qu’après finalisation', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const patient = await request(app).post('/api/patients').set(bearer(admin.token)).send({
      firstName: 'Lina',
      lastName: 'Mbeki',
      dateOfBirth: '1990-04-12',
      gender: 'F',
    });
    expect(patient.status).toBe(201);

    const created = await request(app).post('/api/billing/invoices').set(bearer(admin.token)).send({
      patientId: patient.body.id,
      items: [{ description: 'Consultation', quantity: 1, unitPrice: 40, type: 'consultation' }],
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('draft');
    expect(created.body.finalizedAt).toBeFalsy();

    const tooSoon = await request(app)
      .patch(`/api/billing/invoices/${created.body.id}/pay`)
      .set(bearer(admin.token))
      .send({ paymentMethod: 'card' });
    expect(tooSoon.status).toBe(409);
    expect(tooSoon.body.code).toBe('INVOICE_NOT_FINALIZED');

    const finalized = await request(app)
      .patch(`/api/billing/invoices/${created.body.id}/finalize`)
      .set(bearer(admin.token));
    expect(finalized.status).toBe(200);
    expect(finalized.body.status).toBe('pending');
    expect(finalized.body.finalizedAt).toBeTruthy();
    expect(finalized.body.total).toBe(40);

    const edited = await request(app)
      .put(`/api/billing/invoices/${created.body.id}`)
      .set(bearer(admin.token))
      .send({ notes: 'Changement après finalisation' });
    expect(edited.status).toBe(409);
    expect(edited.body.code).toBe('INVOICE_LOCKED');

    const paid = await request(app)
      .patch(`/api/billing/invoices/${created.body.id}/pay`)
      .set(bearer(admin.token))
      .send({ paymentMethod: 'cash' });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('paid');
    expect(paid.body.paymentMethod).toBe('cash');

    const audit = await AuditLog.findOne({ action: 'INVOICE_FINALIZED', resourceId: created.body.id });
    expect(audit).toBeTruthy();
  });
});
