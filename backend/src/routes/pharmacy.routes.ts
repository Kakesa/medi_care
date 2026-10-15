import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as clinical from '../controllers/clinical.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
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
router.get('/products/low-stock', clinical.lowStock);
router.get('/products', validate(listPharmacySchema), clinical.listProducts);
router.post('/products', validate(createProductSchema), clinical.createProduct);
router.get('/products/:id', validate(productParamsSchema), clinical.getProduct);
router.put('/products/:id', validate(updateProductSchema), clinical.updateProduct);
router.patch('/products/:id/stock', validate(productStockSchema), clinical.updateStock);
router.delete('/products/:id', validate(productParamsSchema), clinical.archiveProduct);
router.get('/orders/pending', clinical.pendingOrders);
router.get('/orders', validate(listPharmacySchema), clinical.listOrders);
router.post('/orders', validate(createOrderSchema), clinical.createOrder);
router.get('/orders/:id', validate(orderParamsSchema), clinical.getOrder);
router.patch('/orders/:id/status', validate(orderStatusSchema), clinical.updateOrderStatus);
router.delete('/orders/:id', validate(orderParamsSchema), clinical.cancelOrder);

export default router;
