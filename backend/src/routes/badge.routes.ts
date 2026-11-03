import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as badges from '../controllers/badge.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { seenBadgesSchema } from '../validators/badge.validator.js';

const router = Router();
const readers = [
  ROLES.HOSPITAL_ADMIN,
  ROLES.DOCTOR,
  ROLES.RECEPTIONIST,
  ROLES.NURSE,
  ROLES.LABORANTIN,
  ROLES.ACCOUNTANT,
  ROLES.PHARMACIST,
  ROLES.PATIENT,
] as const;

router.use(authenticate, requireTenant, requireRoles(...readers));
router.get('/', badges.workBadges);
router.post('/seen', validate(seenBadgesSchema), badges.markSeen);

export default router;
