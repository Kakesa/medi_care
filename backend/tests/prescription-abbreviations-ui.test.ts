import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('Abréviations dans la prescription (Consultation)', () => {
  it('expose le dictionnaire et analyse Tanzol / Artemether pour le médecin', async () => {
    const org = await createOrganization('Consult Abréviations');
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });

    const list = await request(app).get('/api/prescriptions/abbreviations').set(bearer(doctor.token));
    expect(list.status).toBe(200);
    expect(list.body.items.some((item: { code: string }) => item.code === 'ce')).toBe(true);
    expect(list.body.items.some((item: { code: string }) => item.code === 'amp')).toBe(true);

    const tanzol = await request(app).post('/api/prescriptions/parse-line').set(bearer(doctor.token)).send({
      medication: 'Tanzol Cés 400mg DR 2',
      dosage: '1cé /j après 72h',
    });
    expect(tanzol.status).toBe(200);
    expect(tanzol.body.parsed.medicationName.toLowerCase()).toBe('tanzol');
    expect(tanzol.body.parsed.dosage.amount).toBe(400);
    expect(tanzol.body.parsed.quantityProposed).toBe(2);
    expect(tanzol.body.parsed.form.toLowerCase()).toContain('comprim');

    const artemether = await request(app).post('/api/prescriptions/parse-line').set(bearer(doctor.token)).send({
      medication: 'Artemether Amp 80mg DR 5',
      dosage: '2 amps/j || 3j',
    });
    expect(artemether.status).toBe(200);
    expect(artemether.body.parsed.medicationName.toLowerCase()).toBe('artemether');
    expect(artemether.body.parsed.quantityProposed).toBe(6);
    expect(artemether.body.parsed.quantityMarked).toBe(5);
    expect(artemether.body.parsed.alerts.some((alert: { code: string }) => alert.code === 'quantity_ambiguous')).toBe(true);
  });
});
