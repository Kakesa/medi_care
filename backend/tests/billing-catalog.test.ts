import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

async function patientOf(token: string) {
  const patient = await request(app).post('/api/patients').set(bearer(token)).send({
    firstName: 'Lina',
    lastName: 'Mbeki',
    dateOfBirth: '1990-04-12',
    gender: 'F',
  });
  expect(patient.status).toBe(201);
  return patient.body.id as string;
}

describe('Catalogue de prestations', () => {
  it('fige le tarif du catalogue et conserve la devise historique', async () => {
    const org = await createOrganization();
    const other = await createOrganization('Autre hôpital');
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const accountant = await createUser({ role: 'ACCOUNTANT', organizationId: org.id });
    const outsider = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: other.id });

    const settings = await request(app).get('/api/billing/settings').set(bearer(admin.token));
    expect(settings.status).toBe(200);
    expect(settings.body.currency).toBe('EUR');
    expect(settings.body.categories.some((category: { code: string }) => category.code === 'OCCUPATION_LIT')).toBe(true);

    const denied = await request(app).post('/api/billing/services').set(bearer(accountant.token)).send({
      code: 'CONS-GEN',
      name: 'Consultation générale',
      category: 'CONSULTATION',
      unitPrice: 25000,
    });
    expect(denied.status).toBe(403);

    const service = await request(app).post('/api/billing/services').set(bearer(admin.token)).send({
      code: 'scan-tdm',
      name: 'Scanner',
      category: 'SCANNER_TDM',
      unitPrice: 25000,
      unit: 'acte',
    });
    expect(service.status).toBe(201);
    expect(service.body.code).toBe('SCAN-TDM');
    expect(service.body.currency).toBe('EUR');
    expect(service.body.category).toBe('SCANNER_TDM');

    const duplicate = await request(app).post('/api/billing/services').set(bearer(admin.token)).send({
      code: 'SCAN-TDM',
      name: 'Doublon',
      category: 'IMAGERIE',
      unitPrice: 1,
    });
    expect(duplicate.status).toBe(409);

    const patientId = await patientOf(admin.token);
    const legacy = await request(app).post('/api/billing/invoices').set(bearer(admin.token)).send({
      patientId,
      items: [{ description: 'Ancienne consultation', quantity: 1, unitPrice: 40, type: 'consultation' }],
    });
    expect(legacy.status).toBe(201);
    expect(legacy.body.currency).toBe('EUR');
    expect(legacy.body.items[0].category).toBe('CONSULTATION');
    expect(legacy.body.balance).toBe(40);
    expect(legacy.body.paidAmount).toBe(0);

    const invoiced = await request(app).post('/api/billing/invoices').set(bearer(admin.token)).send({
      patientId,
      items: [{ catalogItemId: service.body.id, quantity: 2, unitPrice: 1, description: 'Prix falsifié' }],
    });
    expect(invoiced.status).toBe(201);
    expect(invoiced.body.total).toBe(50000);
    expect(invoiced.body.items[0].unitPrice).toBe(25000);
    expect(invoiced.body.items[0].description).toBe('Scanner');
    expect(invoiced.body.items[0].source).toBe('catalog');
    expect(invoiced.body.currency).toBe('EUR');

    const foreignPatient = await patientOf(outsider.token);
    const leaked = await request(app).post('/api/billing/invoices').set(bearer(outsider.token)).send({
      patientId: foreignPatient,
      items: [{ catalogItemId: service.body.id, quantity: 1 }],
    });
    expect(leaked.status).toBe(404);

    const currency = await request(app).patch('/api/billing/settings').set(bearer(admin.token)).send({ currency: 'CDF' });
    expect(currency.status).toBe(200);
    expect(currency.body.currency).toBe('CDF');

    const historical = await request(app).get(`/api/billing/invoices/${legacy.body.id}`).set(bearer(admin.token));
    expect(historical.body.currency).toBe('EUR');

    const mismatch = await request(app).post('/api/billing/invoices').set(bearer(admin.token)).send({
      patientId,
      items: [{ catalogItemId: service.body.id, quantity: 1 }],
    });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.code).toBe('CURRENCY_MISMATCH');

    const retariff = await request(app).patch(`/api/billing/services/${service.body.id}`).set(bearer(admin.token)).send({
      unitPrice: 80000,
    });
    expect(retariff.status).toBe(200);
    expect(retariff.body.currency).toBe('CDF');
    expect(retariff.body.unitPrice).toBe(80000);

    const stopped = await request(app).patch(`/api/billing/services/${service.body.id}`).set(bearer(admin.token)).send({
      active: false,
    });
    expect(stopped.status).toBe(200);
    const inactive = await request(app).post('/api/billing/invoices').set(bearer(admin.token)).send({
      patientId,
      items: [{ catalogItemId: service.body.id, quantity: 1 }],
    });
    expect(inactive.status).toBe(409);
    expect(inactive.body.code).toBe('SERVICE_INACTIVE');
  });
});
