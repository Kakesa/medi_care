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

describe('Factures visibles par le patient', () => {
  it('ne renvoie que les factures finalisées du patient lié', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const patientUser = await createUser({ role: 'PATIENT', organizationId: org.id });
    const otherUser = await createUser({ role: 'PATIENT', organizationId: org.id });

    const patient = await request(app).post('/api/patients').set(bearer(admin.token)).send({
      firstName: 'Espoir',
      lastName: 'Kakesa',
      dateOfBirth: '1992-01-01',
      gender: 'M',
    });
    expect(patient.status).toBe(201);
    await Patient.updateOne({ _id: patient.body.id }, { linkedUserId: patientUser.user.id });

    const draft = await request(app).post('/api/billing/invoices').set(bearer(admin.token)).send({
      patientId: patient.body.id,
      items: [{ description: 'Brouillon', quantity: 1, unitPrice: 10, type: 'consultation' }],
    });
    expect(draft.status).toBe(201);

    const due = await request(app).post('/api/billing/invoices').set(bearer(admin.token)).send({
      patientId: patient.body.id,
      items: [{ description: 'Consultation', quantity: 1, unitPrice: 40, type: 'consultation' }],
    });
    expect(due.status).toBe(201);
    const finalized = await request(app).patch(`/api/billing/invoices/${due.body.id}/finalize`).set(bearer(admin.token));
    expect(finalized.status).toBe(200);

    const hidden = await request(app).get('/api/billing/my-invoices').set(bearer(patientUser.token));
    expect(hidden.status).toBe(200);
    expect(hidden.body.map((row: { id: string }) => row.id)).toEqual([due.body.id]);
    expect(hidden.body[0].status).toBe('pending');

    const paid = await request(app).patch(`/api/billing/invoices/${due.body.id}/pay`).set(bearer(admin.token)).send({ paymentMethod: 'cash' });
    expect(paid.status).toBe(200);
    const settled = await request(app).get('/api/billing/my-invoices').set(bearer(patientUser.token));
    expect(settled.body[0].status).toBe('paid');
    expect(settled.body[0].total).toBe(40);

    const stranger = await request(app).get('/api/billing/my-invoices').set(bearer(otherUser.token));
    expect(stranger.status).toBe(200);
    expect(stranger.body).toEqual([]);

    const forbidden = await request(app).get('/api/billing/invoices').set(bearer(patientUser.token));
    expect(forbidden.status).toBe(403);
    const byId = await request(app).get(`/api/billing/invoices/${due.body.id}`).set(bearer(patientUser.token));
    expect(byId.status).toBe(403);
  });
});
