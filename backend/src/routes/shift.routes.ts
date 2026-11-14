import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as shifts from '../controllers/shift.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  pushSubscribeSchema,
  shiftCreateSchema,
  shiftEndSchema,
  shiftListSchema,
  shiftParamsSchema,
  shiftReasonSchema,
  shiftReplaceSchema,
  shiftRotationSchema,
  shiftUpdateSchema,
} from '../validators/shift.validator.js';

const router = Router();
const admin = [ROLES.HOSPITAL_ADMIN] as const;

router.use(authenticate, requireTenant);
router.get('/staff', requireRoles(...admin), shifts.staff);
router.get('/', requireRoles(...admin), validate(shiftListSchema), shifts.list);
router.post('/', requireRoles(...admin), validate(shiftCreateSchema), shifts.create);
router.post('/rotations', requireRoles(...admin), validate(shiftRotationSchema), shifts.rotation);
router.patch('/:id', requireRoles(...admin), validate(shiftUpdateSchema), shifts.update);
router.post('/:id/absence', requireRoles(...admin), validate(shiftReasonSchema), shifts.absence);
router.post('/:id/replacement', requireRoles(...admin), validate(shiftReplaceSchema), shifts.replace);
router.get('/mine', requireRoles(ROLES.NURSE), shifts.mine);
router.get('/push-key', requireRoles(ROLES.NURSE), shifts.pushKey);
router.post('/push-subscription', requireRoles(ROLES.NURSE), validate(pushSubscribeSchema), shifts.subscribe);
router.post('/:id/start', requireRoles(ROLES.NURSE), validate(shiftParamsSchema), shifts.start);
router.post('/:id/end', requireRoles(ROLES.NURSE), validate(shiftEndSchema), shifts.end);

export default router;
