import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('Réception et facturation', () => {
  it('laisse la réception encaisser et garde le changement de devise à l’administrateur', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const receptionist = await createUser({ role: 'RECEPTIONIST', organizationId: org.id });
    const patient = await request(app).post('/api/patients').set(bearer(admin.token)).send({
      firstName: 'Lina',
      lastName: 'Mbeki',
      dateOfBirth: '1990-04-12',
      gender: 'F',
    });
    expect(patient.status).toBe(201);

    const created = await request(app).post('/api/billing/invoices').set(bearer(receptionist.token)).send({
      patientId: patient.body.id,
      items: [{ description: 'Consultation', quantity: 1, unitPrice: 25, type: 'consultation' }],
    });
    expect(created.status).toBe(201);

    const list = await request(app).get('/api/billing/invoices').set(bearer(receptionist.token));
    expect(list.status).toBe(200);
    expect(list.body.data.some((row: { id: string }) => row.id === created.body.id)).toBe(true);

    const currency = await request(app).patch('/api/billing/settings').set(bearer(receptionist.token)).send({ currency: 'USD' });
    expect(currency.status).toBe(403);

    const exams = await request(app).get('/api/exams').set(bearer(receptionist.token));
    expect(exams.status).toBe(200);
    const acts = await request(app).get('/api/surgery/acts').set(bearer(receptionist.token));
    expect(acts.status).toBe(200);
  });
});