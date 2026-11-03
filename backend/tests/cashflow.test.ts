import mongoose from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Invoice } from '../src/models/Invoice.js';
import { PharmacyExpense, PharmacySale } from '../src/models/PharmacyOperations.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function invoice(organizationId: string, number: string, status: string, total: number, when: Date) {
  return {
    organizationId,
    invoiceNumber: number,
    patientId: new mongoose.Types.ObjectId(),
    patientName: 'Lina Mbeki',
    date: when,
    dueDate: when,
    items: [{ description: 'Consultation', quantity: 1, unitPrice: total, total, category: 'CONSULTATION' }],
    subtotal: total,
    tax: 0,
    discount: 0,
    total,
    currency: 'EUR',
    status,
    paidAt: status === 'paid' ? when : undefined,
    finalizedAt: status === 'pending' ? when : undefined,
    createdBy: new mongoose.Types.ObjectId(),
  };
}

describe('Rapport des entrées et sorties', () => {
  it('additionne les encaissements et les dépenses payées, sans les factures impayées ni les ventes déjà facturées', async () => {
    const org = await createOrganization();
    const other = await createOrganization();
    const receptionist = await createUser({ role: 'RECEPTIONIST', organizationId: org.id });
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    await Invoice.create(invoice(org.id, 'FAC-IN', 'paid', 20, today));
    await Invoice.create(invoice(org.id, 'FAC-WAIT', 'pending', 40, today));
    await Invoice.create(invoice(org.id, 'FAC-OLD', 'paid', 100, yesterday));
    await Invoice.create(invoice(other.id, 'FAC-FOREIGN', 'paid', 999, today));
    await PharmacySale.create({
      organizationId: org.id,
      number: 'VTE-CASH',
      kind: 'counter',
      lines: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'Paracétamol',
        lotId: new mongoose.Types.ObjectId(),
        lotNumber: 'L1',
        quantity: 1,
        unitPrice: 5,
        unitCost: 1,
        total: 5,
      }],
      total: 5,
      currency: 'EUR',
      settlement: 'paid',
      paymentMethod: 'cash',
      idempotencyKey: `cash-${org.id}`,
      actorId: receptionist.user.id,
    });
    await PharmacySale.create({
      organizationId: org.id,
      number: 'VTE-BILL',
      kind: 'counter',
      lines: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'Déjà facturé',
        lotId: new mongoose.Types.ObjectId(),
        lotNumber: 'L2',
        quantity: 1,
        unitPrice: 80,
        unitCost: 10,
        total: 80,
      }],
      total: 80,
      currency: 'EUR',
      settlement: 'paid',
      paymentMethod: 'card',
      invoiceId: new mongoose.Types.ObjectId(),
      idempotencyKey: `billed-${org.id}`,
      actorId: receptionist.user.id,
    });
    await PharmacyExpense.create({
      organizationId: org.id,
      number: 'DEP-PAID',
      category: 'medicines',
      date: today,
      description: 'Achat de médicaments',
      amount: 12,
      currency: 'EUR',
      status: 'paid',
      paymentMethod: 'transfer',
      requestedBy: receptionist.user.id,
      paidBy: receptionist.user.id,
    });
    await PharmacyExpense.create({
      organizationId: org.id,
      number: 'DEP-WAIT',
      category: 'equipment',
      date: today,
      description: 'Équipement en attente',
      amount: 30,
      currency: 'EUR',
      status: 'approved',
      requestedBy: receptionist.user.id,
    });

    const day = isoDate(today);
    const denied = await request(app).get('/api/billing/cashflow').query({ from: day, to: day }).set(bearer(doctor.token));
    expect(denied.status).toBe(403);

    const reception = await request(app).get('/api/billing/cashflow').query({ from: day, to: day }).set(bearer(receptionist.token));
    expect(reception.status).toBe(200);
    expect(reception.body.service).toBe('reception');
    expect(reception.body.entries.map((row: { reference: string }) => row.reference)).toEqual(['FAC-IN']);
    expect(reception.body.exits).toEqual([]);
    expect(reception.body.totals).toEqual({ income: 20, expense: 0, balance: 20 });
    expect(reception.body.pending.map((row: { reference: string }) => row.reference)).toEqual(['FAC-WAIT']);

    const forced = await request(app).get('/api/billing/cashflow').query({ from: day, to: day, service: 'pharmacy' }).set(bearer(receptionist.token));
    expect(forced.status).toBe(403);
    const widened = await request(app).get('/api/billing/cashflow').query({ from: day, to: day, service: 'all' }).set(bearer(receptionist.token));
    expect(widened.status).toBe(403);

    const pharmacist = await createUser({ role: 'PHARMACIST', organizationId: org.id });
    const pharmacy = await request(app).get('/api/billing/cashflow').query({ from: day, to: day, service: 'reception' }).set(bearer(pharmacist.token));
    expect(pharmacy.status).toBe(403);
    const desk = await request(app).get('/api/billing/cashflow').query({ from: day, to: day }).set(bearer(pharmacist.token));
    expect(desk.status).toBe(200);
    expect(desk.body.service).toBe('pharmacy');
    expect(desk.body.entries.map((row: { reference: string }) => row.reference)).toEqual(['VTE-CASH']);
    expect(desk.body.exits.map((row: { reference: string }) => row.reference)).toEqual(['DEP-PAID']);
    expect(desk.body.entries.some((row: { reference: string }) => row.reference === 'FAC-IN')).toBe(false);

    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const global = await request(app).get('/api/billing/cashflow').query({ from: day, to: day, service: 'all' }).set(bearer(admin.token));
    expect(global.status).toBe(200);
    expect(global.body.entries.map((row: { reference: string; service: string }) => `${row.service}:${row.reference}`).sort()).toEqual(['pharmacy:VTE-CASH', 'reception:FAC-IN']);
    expect(global.body.totals).toEqual({ income: 25, expense: 12, balance: 13 });
    expect(global.body.entries.filter((row: { reference: string }) => row.reference === 'VTE-CASH')).toHaveLength(1);

    const reversed = await request(app).get('/api/billing/cashflow').query({ from: day, to: isoDate(yesterday) }).set(bearer(receptionist.token));
    expect(reversed.status).toBe(400);
  });

  it('répartit une facture mixte sans compter deux fois la part pharmacie', async () => {
    const org = await createOrganization();
    const receptionist = await createUser({ role: 'RECEPTIONIST', organizationId: org.id });
    const pharmacist = await createUser({ role: 'PHARMACIST', organizationId: org.id });
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const today = new Date();
    await Invoice.create({
      organizationId: org.id,
      invoiceNumber: 'FAC-MIX',
      patientId: new mongoose.Types.ObjectId(),
      patientName: 'Lina Mbeki',
      date: today,
      dueDate: today,
      items: [
        { description: 'Consultation', quantity: 1, unitPrice: 30, total: 30, category: 'CONSULTATION' },
        { description: 'Paracétamol', quantity: 1, unitPrice: 10, total: 10, category: 'MEDICAMENT', source: 'pharmacy', originModule: 'pharmacy' },
      ],
      subtotal: 40,
      tax: 0,
      discount: 0,
      total: 40,
      currency: 'EUR',
      status: 'paid',
      paidAt: today,
      paymentMethod: 'cash',
    });
    const day = isoDate(today);
    const reception = await request(app).get('/api/billing/cashflow').query({ from: day, to: day }).set(bearer(receptionist.token));
    expect(reception.body.entries).toEqual([expect.objectContaining({ reference: 'FAC-MIX', amount: 30, service: 'reception' })]);
    const pharmacy = await request(app).get('/api/billing/cashflow').query({ from: day, to: day }).set(bearer(pharmacist.token));
    expect(pharmacy.body.entries).toEqual([expect.objectContaining({ reference: 'FAC-MIX', amount: 10, service: 'pharmacy' })]);
    const global = await request(app).get('/api/billing/cashflow').query({ from: day, to: day, service: 'all' }).set(bearer(admin.token));
    expect(global.body.entries).toHaveLength(2);
    expect(global.body.totals.income).toBe(40);
  });

  it('affiche le total de chaque devise sans les additionner', async () => {
    const org = await createOrganization();
    const receptionist = await createUser({ role: 'RECEPTIONIST', organizationId: org.id });
    const today = new Date();
    await Invoice.create(invoice(org.id, 'FAC-EUR', 'paid', 20, today));
    await Invoice.create({ ...invoice(org.id, 'FAC-CDF', 'paid', 10000, today), currency: 'CDF' });
    const day = isoDate(today);
    const report = await request(app).get('/api/billing/cashflow').query({ from: day, to: day }).set(bearer(receptionist.token));
    expect(report.status).toBe(200);
    expect(report.body.totals).toEqual({ income: 20, expense: 0, balance: 20 });
    expect(report.body.balances).toEqual([
      { currency: 'EUR', income: 20, expense: 0, balance: 20 },
      { currency: 'CDF', income: 10000, expense: 0, balance: 10000 },
    ]);
  });
});
