import type { Request, Response } from 'express';
import { pharmacyPermissionsFor } from '../domain/pharmacyPermissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { organizationCurrency } from '../services/catalog.service.js';
import * as finance from '../services/pharmacyFinance.service.js';
import * as procurement from '../services/procurement.service.js';
import * as sales from '../services/pharmacySale.service.js';
import { PharmacyOrder } from '../models/PharmacyOrder.js';
import { listLots, listMovements, postStock, releaseExpired } from '../services/stock.service.js';
import { ApiError } from '../utils/ApiError.js';
import { requireOwned } from '../services/access.service.js';

const org = (req: Request) => req.organizationId!;
const auth = (req: Request) => req.auth!;

export const pharmacyAccess = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    permissions: pharmacyPermissionsFor(auth(req).role),
    currency: await organizationCurrency(org(req)),
  });
});

export const lots = asyncHandler(async (req: Request, res: Response) => {
  res.json(await listLots(org(req), typeof req.query.productId === 'string' ? req.query.productId : undefined));
});

export const movements = asyncHandler(async (req: Request, res: Response) => {
  res.json(await listMovements(org(req)));
});

export const createMovement = asyncHandler(async (req: Request, res: Response) => {
  const result = await postStock(auth(req), org(req), {
    productId: req.body.productId,
    quantity: req.body.quantity,
    direction: 'out',
    type: req.body.type,
    lotId: req.body.lotId,
    reason: req.body.reason,
    idempotencyKey: req.body.idempotencyKey,
    sourceType: 'manual',
  }, req.ip);
  res.status(result.duplicate ? 200 : 201).json(result);
});

export const suppliers = asyncHandler(async (req: Request, res: Response) => {
  res.json(await procurement.listSuppliers(org(req)));
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await procurement.createSupplier(auth(req), org(req), req.body, req.ip));
});

export const requests = asyncHandler(async (req: Request, res: Response) => {
  res.json(await procurement.listPurchaseRequests(org(req)));
});

export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await procurement.createPurchaseRequest(auth(req), org(req), req.body, req.ip));
});

export const decideRequest = asyncHandler(async (req: Request, res: Response) => {
  res.json(await procurement.decidePurchaseRequest(auth(req), org(req), req.params.id, req.body.decision, req.body.note, req.ip));
});

export const orderRequest = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await procurement.orderFromRequest(auth(req), org(req), req.params.id, req.ip));
});

export const receiveOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await requireOwned(PharmacyOrder, req.params.id, org(req), auth(req), 'pharmacy_order', req.ip);
  res.json(await procurement.receiveOrderQuantity(auth(req), org(req), order, req.body.quantity, {
    lotNumber: req.body.lotNumber,
    expiresAt: req.body.expiresAt,
    purchasePrice: req.body.purchasePrice,
    idempotencyKey: req.body.idempotencyKey,
  }, req.ip));
});

export const salesList = asyncHandler(async (req: Request, res: Response) => {
  res.json(await sales.listSales(org(req)));
});

export const createSale = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await sales.createSale(auth(req), org(req), req.body, req.ip));
});

export const expenses = asyncHandler(async (req: Request, res: Response) => {
  res.json(await finance.listExpenses(org(req)));
});

export const myExpenses = asyncHandler(async (req: Request, res: Response) => {
  res.json(await finance.listExpenses(org(req), auth(req).id));
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await finance.submitExpense(auth(req), org(req), req.body, req.ip));
});

export const decideExpense = asyncHandler(async (req: Request, res: Response) => {
  res.json(await finance.reviewExpense(auth(req), org(req), req.params.id, req.body.decision, req.ip));
});

export const payExpense = asyncHandler(async (req: Request, res: Response) => {
  res.json(await finance.payExpense(auth(req), org(req), req.params.id, req.body.paymentMethod, req.ip));
});

export const supplierInvoices = asyncHandler(async (req: Request, res: Response) => {
  res.json(await finance.listSupplierInvoices(org(req)));
});

export const payInvoice = asyncHandler(async (req: Request, res: Response) => {
  res.json(await finance.paySupplierInvoice(auth(req), org(req), req.params.id, req.ip));
});

export const budgets = asyncHandler(async (req: Request, res: Response) => {
  res.json(await finance.listBudgets(org(req)));
});

export const saveBudget = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.periodEnd <= req.body.periodStart) throw new ApiError(400, 'Période invalide', 'VALIDATION_ERROR');
  res.status(201).json(await finance.saveBudget(auth(req), org(req), req.body, req.ip));
});

export const financeReport = asyncHandler(async (req: Request, res: Response) => {
  res.json(await finance.financeSummary(org(req)));
});

export const operationsReport = asyncHandler(async (req: Request, res: Response) => {
  await releaseExpired(org(req), auth(req));
  const [lots, movements, requests] = await Promise.all([
    listLots(org(req)),
    listMovements(org(req)),
    procurement.listPurchaseRequests(org(req)),
  ]);
  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  res.json({
    expiring: lots.filter((lot) => lot.expiresAt && lot.status !== 'depleted' && new Date(lot.expiresAt) <= horizon),
    movements: movements.slice(0, 8),
    requests: requests.filter((request) => request.status === 'submitted'),
  });
});
