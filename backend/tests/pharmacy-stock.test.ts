import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { StockLot } from '../src/models/StockLot.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

async function product(token: string, quantity: number, extra: Record<string, unknown> = {}) {
  const created = await request(app).post('/api/pharmacy/products').set(bearer(token)).send({
    name: 'Paracétamol',
    category: 'Antalgiques',
    quantity,
    minStock: 2,
    unit: 'boite',
    price: 5,
    purchasePrice: 2,
    ...extra,
  });
  expect(created.status).toBe(201);
  return created.body;
}

describe('Pharmacie : stock, achats et dépenses', () => {
  it('trace les lots, bloque les sorties invalides et isole les établissements', async () => {
    const org = await createOrganization();
    const other = await createOrganization('Autre pharmacie');
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const reviewer = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const pharmacist = await createUser({ role: 'PHARMACIST', organizationId: org.id });
    const outsider = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: other.id });

    const item = await product(admin.token, 5);
    expect(item.quantity).toBe(5);
    const edited = await request(app).put(`/api/pharmacy/products/${item.id}`).set(bearer(admin.token)).send({ quantity: 99, price: 6 });
    expect(edited.status).toBe(200);
    expect(edited.body.quantity).toBe(5);
    expect(edited.body.price).toBe(6);

    const deniedCreate = await request(app).post('/api/pharmacy/products').set(bearer(pharmacist.token)).send({
      name: 'Interdit', category: 'Autre', quantity: 1, minStock: 0, unit: 'boite', price: 1,
    });
    expect(deniedCreate.status).toBe(403);

    const tooMuch = await request(app).post('/api/pharmacy/sales').set(bearer(pharmacist.token)).send({
      kind: 'counter', settlement: 'paid', paymentMethod: 'cash', idempotencyKey: 'sale-too-much',
      lines: [{ productId: item.id, quantity: 9 }],
    });
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.code).toBe('INSUFFICIENT_STOCK');

    const sold = await request(app).post('/api/pharmacy/sales').set(bearer(pharmacist.token)).send({
      kind: 'counter', settlement: 'paid', paymentMethod: 'cash', idempotencyKey: 'sale-once',
      lines: [{ productId: item.id, quantity: 2 }],
    });
    expect(sold.status).toBe(201);
    expect(sold.body.lines[0].lotNumber).toBe('OUVERTURE');
    expect(sold.body.total).toBe(12);
    const replay = await request(app).post('/api/pharmacy/sales').set(bearer(pharmacist.token)).send({
      kind: 'counter', settlement: 'paid', paymentMethod: 'cash', idempotencyKey: 'sale-once',
      lines: [{ productId: item.id, quantity: 2 }],
    });
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(sold.body.id);
    const afterSale = await request(app).get(`/api/pharmacy/products/${item.id}`).set(bearer(admin.token));
    expect(afterSale.body.quantity).toBe(3);

    const lot = await StockLot.findOne({ productId: item.id });
    lot!.expiresAt = new Date('2020-01-01');
    await lot!.save();
    const expired = await request(app).post('/api/pharmacy/sales').set(bearer(pharmacist.token)).send({
      kind: 'counter', settlement: 'paid', paymentMethod: 'cash', idempotencyKey: 'sale-expired',
      lines: [{ productId: item.id, quantity: 1 }],
    });
    expect(expired.status).toBe(409);

    const order = await request(app).post('/api/pharmacy/orders').set(bearer(admin.token)).send({
      productId: item.id, quantity: 10,
    });
    expect(order.status).toBe(201);
    const unchanged = await request(app).get(`/api/pharmacy/products/${item.id}`).set(bearer(admin.token));
    expect(unchanged.body.quantity).toBe(0);

    const partial = await request(app).post(`/api/pharmacy/orders/${order.body.id}/receive`).set(bearer(pharmacist.token)).send({
      quantity: 4, lotNumber: 'L-1', purchasePrice: 10, idempotencyKey: 'recv-1',
      expiresAt: '2027-01-01',
    });
    expect(partial.status).toBe(200);
    expect(partial.body.status).toBe('partial');
    expect(partial.body.receivedQuantity).toBe(4);
    const replayReceipt = await request(app).post(`/api/pharmacy/orders/${order.body.id}/receive`).set(bearer(pharmacist.token)).send({
      quantity: 4, lotNumber: 'L-1', purchasePrice: 10, idempotencyKey: 'recv-1', expiresAt: '2027-01-01',
    });
    expect(replayReceipt.body.receivedQuantity).toBe(4);
    const rest = await request(app).post(`/api/pharmacy/orders/${order.body.id}/receive`).set(bearer(pharmacist.token)).send({
      quantity: 6, lotNumber: 'L-2', purchasePrice: 10, idempotencyKey: 'recv-2', expiresAt: '2027-06-01',
    });
    expect(rest.body.status).toBe('delivered');
    expect(rest.body.receivedQuantity).toBe(10);
    const restocked = await request(app).get(`/api/pharmacy/products/${item.id}`).set(bearer(admin.token));
    expect(restocked.body.quantity).toBe(10);

    const leaked = await request(app).get(`/api/pharmacy/products/${item.id}`).set(bearer(outsider.token));
    expect(leaked.status).toBe(404);

    const ask = await request(app).post('/api/pharmacy/requests').set(bearer(pharmacist.token)).send({
      lines: [{ productId: item.id, quantity: 3, reason: 'Seuil bas' }],
    });
    expect(ask.status).toBe(201);
    const self = await request(app).patch(`/api/pharmacy/requests/${ask.body.id}`).set(bearer(pharmacist.token)).send({ decision: 'approve' });
    expect(self.status).toBe(403);
    const ownAdmin = await request(app).post('/api/pharmacy/requests').set(bearer(admin.token)).send({
      lines: [{ productId: item.id, quantity: 1, reason: 'Réserve' }],
    });
    const selfAdmin = await request(app).patch(`/api/pharmacy/requests/${ownAdmin.body.id}`).set(bearer(admin.token)).send({ decision: 'approve' });
    expect(selfAdmin.status).toBe(403);
    expect(selfAdmin.body.code).toBe('SELF_APPROVAL');
    const approved = await request(app).patch(`/api/pharmacy/requests/${ask.body.id}`).set(bearer(reviewer.token)).send({ decision: 'approve' });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('approved');

    expect((await request(app).get('/api/pharmacy/finance').set(bearer(pharmacist.token))).status).toBe(403);
    expect((await request(app).get('/api/pharmacy/budgets').set(bearer(pharmacist.token))).status).toBe(403);
    expect((await request(app).get('/api/pharmacy/expenses').set(bearer(pharmacist.token))).status).toBe(403);

    const budget = await request(app).post('/api/pharmacy/budgets').set(bearer(admin.token)).send({
      periodStart: '2026-01-01', periodEnd: '2026-12-31', category: 'medicines', amount: 1000,
    });
    expect(budget.status).toBe(201);
    const invoices = await request(app).get('/api/pharmacy/supplier-invoices').set(bearer(admin.token));
    expect(invoices.body[0].amount).toBe(100);
    const paid = await request(app).post(`/api/pharmacy/supplier-invoices/${invoices.body[0].id}/pay`).set(bearer(admin.token));
    expect(paid.status).toBe(200);
    const paidAgain = await request(app).post(`/api/pharmacy/supplier-invoices/${invoices.body[0].id}/pay`).set(bearer(admin.token));
    expect(paidAgain.body.expense.id).toBe(paid.body.expense.id);
    const finance = await request(app).get('/api/pharmacy/finance').set(bearer(admin.token));
    expect(finance.body.paid).toBe(100);
    expect(finance.body.unpaidInvoices).toBe(0);
    expect(finance.body.remaining).toBe(900);
  });
});
