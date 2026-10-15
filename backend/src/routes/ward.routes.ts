import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as bedController from '../controllers/bed.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createWardSchema,
  listWardsSchema,
  updateWardSchema,
  wardParamsSchema,
} from '../validators/bed.validator.js';

const router = Router();

router.use(authenticate, requireTenant, requireRoles(ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST));
router.get('/', validate(listWardsSchema), bedController.listWards);
router.post('/', validate(createWardSchema), bedController.createWard);
router.get('/:id', validate(wardParamsSchema), bedController.getWard);
router.put('/:id', validate(updateWardSchema), bedController.updateWard);
router.delete('/:id', validate(wardParamsSchema), bedController.deleteWard);

export default router;
