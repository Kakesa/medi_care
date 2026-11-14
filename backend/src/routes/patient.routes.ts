import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as patientController from '../controllers/patient.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createPatientSchema,
  listPatientsSchema,
  patientParamsSchema,
  updatePatientSchema,
} from '../validators/patient.validator.js';

const router = Router();
const readRoles = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.NURSE, ROLES.PATIENT] as const;
const writeRoles = [ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR] as const;

router.use(authenticate, requireTenant);
router.get('/', requireRoles(...readRoles), validate(listPatientsSchema), patientController.list);
router.post('/', requireRoles(ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST), validate(createPatientSchema), patientController.create);
router.get('/:id', requireRoles(...readRoles), validate(patientParamsSchema), patientController.getById);
router.put('/:id', requireRoles(...writeRoles), validate(updatePatientSchema), patientController.update);
router.delete('/:id', requireRoles(ROLES.HOSPITAL_ADMIN), validate(patientParamsSchema), patientController.archive);

export default router;
