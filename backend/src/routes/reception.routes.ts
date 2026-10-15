import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as clinical from '../controllers/clinical.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createReceptionSchema,
  listReceptionSchema,
  receptionAssignSchema,
  receptionParamsSchema,
  receptionStatusSchema,
  updateReceptionSchema,
} from '../validators/clinical.validator.js';

const router = Router();
const roles = [ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST] as const;

router.use(authenticate, requireTenant, requireRoles(...roles));
router.get('/waiting', clinical.waitingReception);
router.get('/stats/today', clinical.receptionStats);
router.get('/', validate(listReceptionSchema), clinical.listReception);
router.post('/', validate(createReceptionSchema), clinical.createReception);
router.get('/:id', validate(receptionParamsSchema), clinical.getReception);
router.put('/:id', validate(updateReceptionSchema), clinical.updateReception);
router.patch('/:id/status', validate(receptionStatusSchema), clinical.updateReceptionStatus);
router.patch('/:id/assign', validate(receptionAssignSchema), clinical.assignReception);
router.delete('/:id', validate(receptionParamsSchema), clinical.cancelReception);

export default router;
