import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as clinical from '../controllers/clinical.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createPersonnelSchema,
  listPersonnelSchema,
  personnelParamsSchema,
  personnelStatusSchema,
  updatePersonnelSchema,
} from '../validators/clinical.validator.js';

const router = Router();
const read = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.NURSE] as const;

router.use(authenticate, requireTenant);
router.get('/doctors', requireRoles(...read, ROLES.PATIENT), clinical.listDoctors);
router.get('/', requireRoles(...read), validate(listPersonnelSchema), clinical.listPersonnel);
router.post('/', requireRoles(ROLES.HOSPITAL_ADMIN), validate(createPersonnelSchema), clinical.createPersonnel);
router.get('/:id', requireRoles(...read), validate(personnelParamsSchema), clinical.getPersonnel);
router.put('/:id', requireRoles(ROLES.HOSPITAL_ADMIN), validate(updatePersonnelSchema), clinical.updatePersonnel);
router.patch('/:id/status', requireRoles(ROLES.HOSPITAL_ADMIN), validate(personnelStatusSchema), clinical.updatePersonnelStatus);
router.delete('/:id', requireRoles(ROLES.HOSPITAL_ADMIN), validate(personnelParamsSchema), clinical.archivePersonnel);

export default router;
