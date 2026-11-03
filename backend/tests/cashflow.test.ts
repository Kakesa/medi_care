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

    const report = await request(app).get('/api/billing/cashflow').query({ from: day, to: day }).set(bearer(receptionist.token));
    expect(report.status).toBe(200);
    expect(report.body.entries.map((row: { reference: string }) => row.reference).sort()).toEqual(['FAC-IN', 'VTE-CASH']);
    expect(report.body.exits.map((row: { reference: string }) => row.reference)).toEqual(['DEP-PAID']);
    expect(report.body.totals).toEqual({ income: 25, expense: 12, balance: 13 });
    expect(report.body.pending.map((row: { reference: string }) => row.reference).sort()).toEqual(['DEP-WAIT', 'FAC-WAIT']);
    expect(report.body.entries.some((row: { reference: string }) => row.reference === 'FAC-FOREIGN')).toBe(false);
    expect(report.body.incomeByCategory).toEqual(expect.arrayContaining([
      { category: 'Consultation', amount: 20 },
      { category: 'Médicament', amount: 5 },
    ]));

    const reversed = await request(app).get('/api/billing/cashflow').query({ from: day, to: isoDate(yesterday) }).set(bearer(receptionist.token));
    expect(reversed.status).toBe(400);
  });
});
