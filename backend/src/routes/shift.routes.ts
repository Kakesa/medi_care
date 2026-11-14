import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as shifts from '../controllers/shift.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  cycleCreateSchema,
  cycleUpdateSchema,
  pushSubscribeSchema,
  shiftCopySchema,
  shiftCreateSchema,
  shiftEndSchema,
  shiftListSchema,
  shiftParamsSchema,
  shiftPublishSchema,
  shiftReasonSchema,
  shiftReplaceSchema,
  shiftRotationSchema,
  shiftUpdateSchema,
  templateCreateSchema,
  templateUpdateSchema,
} from '../validators/shift.validator.js';

const router = Router();
const admin = [ROLES.HOSPITAL_ADMIN] as const;

router.use(authenticate, requireTenant);
router.get('/staff', requireRoles(...admin), shifts.staff);
router.get('/templates', requireRoles(...admin), shifts.templates);
router.post('/templates', requireRoles(...admin), validate(templateCreateSchema), shifts.createTemplate);
router.patch('/templates/:id', requireRoles(...admin), validate(templateUpdateSchema), shifts.updateTemplate);
router.delete('/templates/:id', requireRoles(...admin), validate(shiftParamsSchema), shifts.deleteTemplate);
router.get('/cycles', requireRoles(...admin), shifts.cycles);
router.post('/cycles', requireRoles(...admin), validate(cycleCreateSchema), shifts.createCycle);
router.patch('/cycles/:id', requireRoles(...admin), validate(cycleUpdateSchema), shifts.updateCycle);
router.delete('/cycles/:id', requireRoles(...admin), validate(shiftParamsSchema), shifts.deleteCycle);
router.post('/publish', requireRoles(...admin), validate(shiftPublishSchema), shifts.publish);
router.post('/copy', requireRoles(...admin), validate(shiftCopySchema), shifts.copy);
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
