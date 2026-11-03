import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as lab from '../controllers/lab.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { labDecisionSchema, labDraftSchema, labParamsSchema, listLabSchema, orderLabSchema } from '../validators/lab.validator.js';

const router = Router();
const readers = [ROLES.HOSPITAL_ADMIN, ROLES.LABORANTIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE] as const;

router.use(authenticate, requireTenant);
router.get('/', requireRoles(...readers), validate(listLabSchema), lab.listLab);
router.post('/orders', requireRoles(ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST), validate(orderLabSchema), lab.orderLab);
router.get('/:id', requireRoles(...readers), validate(labParamsSchema), lab.getLab);
router.post('/:id/start', requireRoles(ROLES.LABORANTIN), validate(labParamsSchema), lab.startLab);
router.post('/:id/draft', requireRoles(ROLES.LABORANTIN), validate(labDraftSchema), lab.draftLab);
router.post('/:id/submit', requireRoles(ROLES.LABORANTIN), validate(labParamsSchema), lab.submitLab);
router.post('/:id/validate', requireRoles(ROLES.HOSPITAL_ADMIN), validate(labDecisionSchema), lab.validateLab);
router.post('/:id/correction', requireRoles(ROLES.HOSPITAL_ADMIN), validate(labDecisionSchema), lab.correctLab);
router.post('/:id/reject', requireRoles(ROLES.HOSPITAL_ADMIN), validate(labDecisionSchema), lab.rejectLab);
router.post('/:id/cancel', requireRoles(ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST), validate(labParamsSchema), lab.cancelLab);

export default router;
