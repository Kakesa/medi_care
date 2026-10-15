import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as clinical from '../controllers/clinical.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  billingSettingsSchema,
  createInvoiceSchema,
  createServiceSchema,
  invoiceByPatientSchema,
  invoiceParamsSchema,
  listInvoicesSchema,
  payInvoiceSchema,
  updateInvoiceSchema,
  updateServiceSchema,
} from '../validators/clinical.validator.js';

const router = Router();
const roles = [ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT] as const;

router.use(authenticate, requireTenant, requireRoles(...roles));
router.get('/settings', clinical.billingSettings);
router.patch('/settings', requireRoles(ROLES.HOSPITAL_ADMIN), validate(billingSettingsSchema), clinical.updateBillingSettings);
router.get('/services', clinical.listServices);
router.post('/services', requireRoles(ROLES.HOSPITAL_ADMIN), validate(createServiceSchema), clinical.createService);
router.patch('/services/:id', requireRoles(ROLES.HOSPITAL_ADMIN), validate(updateServiceSchema), clinical.updateService);
router.get('/stats', clinical.invoiceStats);
router.get('/patients', clinical.billingPatients);
router.get('/generate-number', clinical.generateNumber);
router.get('/invoices/overdue', clinical.overdueInvoices);
router.get('/invoices/by-patient/:patientId', validate(invoiceByPatientSchema), clinical.invoicesByPatient);
router.get('/invoices', validate(listInvoicesSchema), clinical.listInvoices);
router.post('/invoices', validate(createInvoiceSchema), clinical.createInvoice);
router.get('/invoices/:id', validate(invoiceParamsSchema), clinical.getInvoice);
router.put('/invoices/:id', validate(updateInvoiceSchema), clinical.updateInvoice);
router.patch('/invoices/:id/finalize', validate(invoiceParamsSchema), clinical.finalizeInvoice);
router.patch('/invoices/:id/pay', validate(payInvoiceSchema), clinical.payInvoice);
router.patch('/invoices/:id/cancel', validate(invoiceParamsSchema), clinical.cancelInvoice);
router.delete('/invoices/:id', validate(invoiceParamsSchema), clinical.deleteInvoice);

export default router;
