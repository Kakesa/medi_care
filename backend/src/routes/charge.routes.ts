import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as charges from '../controllers/charge.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { listChargesSchema, recommendChargeSchema, updateChargeSchema } from '../validators/charge.validator.js';

const router = Router();
const readers = [ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT, ROLES.DOCTOR, ROLES.NURSE] as const;
const prescribers = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE] as const;

router.use(authenticate, requireTenant, requireRoles(...readers));
router.get('/catalog', requireRoles(...prescribers), charges.catalog);
router.get('/', validate(listChargesSchema), charges.list);
router.post('/', requireRoles(...prescribers), validate(recommendChargeSchema), charges.recommend);
router.patch('/:id', requireRoles(...prescribers), validate(updateChargeSchema), charges.update);

export default router;
