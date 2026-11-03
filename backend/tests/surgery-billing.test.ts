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

describe('Chirurgie et facturation', () => {
  it('tarif l’acte dans la facture existante et conserve l’ancien prix', async () => {
    const org = await createOrganization();
    const other = await createOrganization('Autre bloc');
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const accountant = await createUser({ role: 'ACCOUNTANT', organizationId: org.id });
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const outsider = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: other.id });

    const denied = await request(app).get('/api/surgery/acts').set(bearer(doctor.token));
    expect(denied.status).toBe(403);

    const catalog = await request(app).get('/api/surgery/acts').set(bearer(accountant.token));
    expect(catalog.status).toBe(200);
    expect(catalog.body.currency).toBe('EUR');
    expect(catalog.body.total).toBe(42);
    expect(catalog.body.data.every((act: { unitPrice: number | null }) => act.unitPrice === null)).toBe(true);

    const appendectomy = catalog.body.data.find((act: { name: string }) => act.name === 'Appendicectomie');
    const hernia = catalog.body.data.find((act: { name: string }) => act.name === 'Herniorraphie');
    const cesarean = catalog.body.data.find((act: { name: string }) => act.name === 'Césarienne');
    expect(appendectomy.billable).toBe(false);

    const duplicate = await request(app).post('/api/surgery/acts').set(bearer(accountant.token)).send({
      name: 'appendicectomie',
      categoryId: appendectomy.categoryId,
      description: 'Doublon',
    });
    expect(duplicate.status).toBe(409);

    const priced = await request(app).patch(`/api/surgery/acts/${appendectomy.id}`).set(bearer(accountant.token)).send({
      unitPrice: 150,
    });
    expect(priced.status).toBe(200);
    expect(priced.body.unitPrice).toBe(150);
    expect(priced.body.currency).toBe('EUR');
    expect(priced.body.billable).toBe(true);

    await request(app).patch(`/api/surgery/acts/${hernia.id}`).set(bearer(admin.token)).send({ unitPrice: 200 });
    await request(app).patch(`/api/surgery/acts/${cesarean.id}`).set(bearer(admin.token)).send({ unitPrice: 250, description: 'Incision utérine programmée.' });

    const history = await request(app).get('/api/surgery/prices').query({ actId: appendectomy.id }).set(bearer(accountant.token));
    expect(history.status).toBe(200);
    expect(history.body[0].previousPrice).toBeNull();
    expect(history.body[0].nextPrice).toBe(150);
    expect(history.body[0].nextCurrency).toBe('EUR');
    expect(history.body[0].changedByName).toBe('Ada Martin');

    const patientId = await patientOf(admin.token);
    const unpriced = catalog.body.data.find((act: { name: string }) => act.name === 'Laparotomie');
    const missingPrice = await request(app).post('/api/billing/invoices').set(bearer(accountant.token)).send({
      patientId,
      items: [{ surgicalActId: unpriced.id, quantity: 1, unitPrice: 999 }],
    });
    expect(missingPrice.status).toBe(409);
    expect(missingPrice.body.code).toBe('ACT_UNPRICED');

    const invoiced = await request(app).post('/api/billing/invoices').set(bearer(accountant.token)).send({
      patientId,
      items: [
        { surgicalActId: appendectomy.id, quantity: 2, unitPrice: 1, description: 'Prix falsifié' },
        { surgicalActId: hernia.id, quantity: 1, unitPrice: 1 },
        { description: 'Consultation associée', quantity: 1, unitPrice: 40, type: 'consultation' },
      ],
    });
    expect(invoiced.status).toBe(201);
    expect(invoiced.body.currency).toBe('EUR');
    expect(invoiced.body.items[0].unitPrice).toBe(150);
    expect(invoiced.body.items[0].total).toBe(300);
    expect(invoiced.body.items[0].source).toBe('surgery');
    expect(invoiced.body.items[0].category).toBe('CHIRURGIE');
    expect(invoiced.body.items[0].description).toBe('Appendicectomie');
    expect(invoiced.body.total).toBe(540);

    const repeated = await request(app).post('/api/billing/invoices').set(bearer(accountant.token)).send({
      patientId,
      items: [
        { surgicalActId: cesarean.id, quantity: 1 },
        { surgicalActId: cesarean.id, quantity: 1 },
      ],
    });
    expect(repeated.status).toBe(409);
    expect(repeated.body.code).toBe('DUPLICATE_ACT');

    const finalized = await request(app).patch(`/api/billing/invoices/${invoiced.body.id}/finalize`).set(bearer(accountant.token));
    expect(finalized.status).toBe(200);

    const raised = await request(app).patch(`/api/surgery/acts/${appendectomy.id}`).set(bearer(admin.token)).send({ unitPrice: 180 });
    expect(raised.status).toBe(200);
    const preserved = await request(app).get(`/api/billing/invoices/${invoiced.body.id}`).set(bearer(admin.token));
    expect(preserved.body.items[0].unitPrice).toBe(150);
    expect(preserved.body.total).toBe(540);

    const later = await request(app).post('/api/billing/invoices').set(bearer(admin.token)).send({
      patientId,
      items: [{ surgicalActId: appendectomy.id, quantity: 1, unitPrice: 1 }],
    });
    expect(later.status).toBe(201);
    expect(later.body.items[0].unitPrice).toBe(180);
    expect(later.body.currency).toBe('EUR');

    const currency = await request(app).patch('/api/billing/settings').set(bearer(admin.token)).send({ currency: 'USD' });
    expect(currency.status).toBe(200);
    const stillEur = await request(app).get(`/api/billing/invoices/${invoiced.body.id}`).set(bearer(admin.token));
    expect(stillEur.body.currency).toBe('EUR');
    const mismatch = await request(app).post('/api/billing/invoices').set(bearer(accountant.token)).send({
      patientId,
      items: [{ surgicalActId: appendectomy.id, quantity: 1 }],
    });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.code).toBe('CURRENCY_MISMATCH');

    const retariff = await request(app).patch(`/api/surgery/acts/${appendectomy.id}`).set(bearer(accountant.token)).send({ unitPrice: 210 });
    expect(retariff.body.currency).toBe('USD');
    const usdInvoice = await request(app).post('/api/billing/invoices').set(bearer(accountant.token)).send({
      patientId,
      items: [{ surgicalActId: appendectomy.id, quantity: 1 }],
    });
    expect(usdInvoice.status).toBe(201);
    expect(usdInvoice.body.currency).toBe('USD');
    expect(usdInvoice.body.items[0].unitPrice).toBe(210);
    expect(stillEur.body.currency).toBe('EUR');
    const usdFinal = await request(app).patch(`/api/billing/invoices/${usdInvoice.body.id}/finalize`).set(bearer(accountant.token));
    expect(usdFinal.status).toBe(200);

    const stopped = await request(app).patch(`/api/surgery/acts/${appendectomy.id}`).set(bearer(admin.token)).send({ active: false });
    expect(stopped.status).toBe(200);
    const inactive = await request(app).post('/api/billing/invoices').set(bearer(accountant.token)).send({
      patientId,
      items: [{ surgicalActId: appendectomy.id, quantity: 1 }],
    });
    expect(inactive.status).toBe(409);
    expect(inactive.body.code).toBe('ACT_INACTIVE');

    const foreignPatient = await patientOf(outsider.token);
    const leaked = await request(app).post('/api/billing/invoices').set(bearer(outsider.token)).send({
      patientId: foreignPatient,
      items: [{ surgicalActId: hernia.id, quantity: 1 }],
    });
    expect(leaked.status).toBe(404);

    const patientHistory = await request(app).get(`/api/surgery/patients/${patientId}/history`).set(bearer(accountant.token));
    expect(patientHistory.status).toBe(200);
    expect(patientHistory.body.some((line: { invoiceNumber: string; unitPrice: number }) => line.invoiceNumber === invoiced.body.invoiceNumber && line.unitPrice === 150)).toBe(true);

    const stats = await request(app).get('/api/surgery/stats').set(bearer(admin.token));
    expect(stats.status).toBe(200);
    expect(stats.body.acts.total).toBe(42);
    expect(stats.body.acts.inactive).toBe(1);
    expect(stats.body.currency).toBe('USD');
    expect(stats.body.billed.quantity).toBe(1);
    expect(stats.body.billed.amount).toBe(210);
    expect(stats.body.otherCurrencies.some((entry: { currency: string; amount: number }) => entry.currency === 'EUR' && entry.amount === 500)).toBe(true);
  });
});
