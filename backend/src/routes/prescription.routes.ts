import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as lab from '../controllers/lab.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createPrescriptionSchema,
  dispenseSchema,
  listPrescriptionsSchema,
  prescriptionParamsSchema,
  unavailableSchema,
} from '../validators/prescription.validator.js';

const router = Router();
const readers = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST, ROLES.NURSE] as const;
const prescribers = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR] as const;
const pharmacy = [ROLES.PHARMACIST] as const;

router.use(authenticate, requireTenant);
router.get('/', requireRoles(...readers), validate(listPrescriptionsSchema), lab.listPrescriptions);
router.post('/', requireRoles(...prescribers), validate(createPrescriptionSchema), lab.createPrescription);
router.post('/:id/validate', requireRoles(...prescribers), validate(prescriptionParamsSchema), lab.validatePrescription);
router.post('/:id/prepare', requireRoles(...pharmacy), validate(prescriptionParamsSchema), lab.preparePrescription);
router.post('/:id/dispense', requireRoles(...pharmacy), validate(dispenseSchema), lab.dispensePrescription);
router.post('/:id/unavailable', requireRoles(...pharmacy), validate(unavailableSchema), lab.unavailablePrescription);
router.post('/:id/close', requireRoles(...pharmacy), validate(prescriptionParamsSchema), lab.closePrescription);

export default router;
