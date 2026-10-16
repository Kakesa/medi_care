import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import { PHARMACY_PERMISSIONS as P } from '../domain/pharmacyPermissions.js';
import * as clinical from '../controllers/clinical.controller.js';
import * as pharmacy from '../controllers/pharmacy.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePharmacy } from '../middlewares/pharmacy.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  budgetSchema,
  expenseDecisionSchema,
  expensePaySchema,
  expenseSchema,
  movementSchema,
  pharmacyParamsSchema,
  purchaseRequestSchema,
  receiveOrderSchema,
  requestDecisionSchema,
  saleSchema,
  supplierSchema,
} from '../validators/pharmacy.validator.js';
import {
  createOrderSchema,
  createProductSchema,
  listPharmacySchema,
  orderParamsSchema,
  orderStatusSchema,
  productParamsSchema,
  productStockSchema,
  updateProductSchema,
} from '../validators/clinical.validator.js';

const router = Router();
const roles = [ROLES.HOSPITAL_ADMIN, ROLES.PHARMACIST] as const;

router.use(authenticate, requireTenant, requireRoles(...roles));
router.get('/access', pharmacy.pharmacyAccess);
router.get('/operations', requirePharmacy(P.REPORTS_OPERATIONS), pharmacy.operationsReport);
router.get('/finance', requirePharmacy(P.REPORTS_FINANCIAL), pharmacy.financeReport);
router.get('/lots', requirePharmacy(P.STOCK_VIEW), pharmacy.lots);
router.get('/movements', requirePharmacy(P.STOCK_VIEW), pharmacy.movements);
router.post('/movements', requirePharmacy(P.STOCK_RECEIVE), validate(movementSchema), pharmacy.createMovement);
router.get('/suppliers', requirePharmacy(P.SUPPLIERS_VIEW), pharmacy.suppliers);
router.post('/suppliers', requirePharmacy(P.SUPPLIERS_MANAGE), validate(supplierSchema), pharmacy.createSupplier);
router.get('/requests', pharmacy.requests);
router.post('/requests', requirePharmacy(P.PURCHASE_REQUEST), validate(purchaseRequestSchema), pharmacy.createRequest);
router.patch('/requests/:id', requirePharmacy(P.PURCHASE_APPROVE), validate(requestDecisionSchema), pharmacy.decideRequest);
router.post('/requests/:id/order', requirePharmacy(P.PURCHASE_APPROVE), validate(pharmacyParamsSchema), pharmacy.orderRequest);
router.get('/sales', requirePharmacy(P.SALES_CREATE), pharmacy.salesList);
router.post('/sales', requirePharmacy(P.SALES_CREATE), validate(saleSchema), pharmacy.createSale);
router.get('/expenses/mine', requirePharmacy(P.EXPENSES_SUBMIT), pharmacy.myExpenses);
router.get('/expenses', requirePharmacy(P.EXPENSES_VIEW), pharmacy.expenses);
router.post('/expenses', requirePharmacy(P.EXPENSES_SUBMIT), validate(expenseSchema), pharmacy.createExpense);
router.patch('/expenses/:id/pay', requirePharmacy(P.EXPENSES_PAY), validate(expensePaySchema), pharmacy.payExpense);
router.patch('/expenses/:id', requirePharmacy(P.EXPENSES_APPROVE), validate(expenseDecisionSchema), pharmacy.decideExpense);
router.get('/supplier-invoices', requirePharmacy(P.EXPENSES_VIEW), pharmacy.supplierInvoices);
router.post('/supplier-invoices/:id/pay', requirePharmacy(P.EXPENSES_PAY), validate(pharmacyParamsSchema), pharmacy.payInvoice);
router.get('/budgets', requirePharmacy(P.BUDGET_VIEW), pharmacy.budgets);
router.post('/budgets', requirePharmacy(P.BUDGET_MANAGE), validate(budgetSchema), pharmacy.saveBudget);
router.get('/products/low-stock', clinical.lowStock);
router.get('/products', validate(listPharmacySchema), clinical.listProducts);
router.post('/products', requirePharmacy(P.PRODUCTS_MANAGE), validate(createProductSchema), clinical.createProduct);
router.get('/products/:id', validate(productParamsSchema), clinical.getProduct);
router.put('/products/:id', requirePharmacy(P.PRODUCTS_MANAGE), validate(updateProductSchema), clinical.updateProduct);
router.patch('/products/:id/stock', validate(productStockSchema), clinical.updateStock);
router.delete('/products/:id', requirePharmacy(P.PRODUCTS_MANAGE), validate(productParamsSchema), clinical.archiveProduct);
router.get('/orders/pending', clinical.pendingOrders);
router.get('/orders', validate(listPharmacySchema), clinical.listOrders);
router.post('/orders', requirePharmacy(P.PURCHASE_APPROVE), validate(createOrderSchema), clinical.createOrder);
router.post('/orders/:id/receive', requirePharmacy(P.STOCK_RECEIVE), validate(receiveOrderSchema), pharmacy.receiveOrder);
router.get('/orders/:id', validate(orderParamsSchema), clinical.getOrder);
router.patch('/orders/:id/status', validate(orderStatusSchema), clinical.updateOrderStatus);
router.delete('/orders/:id', validate(orderParamsSchema), clinical.cancelOrder);

export default router;
