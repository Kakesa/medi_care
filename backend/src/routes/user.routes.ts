import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createUserSchema,
  listUsersSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '../validators/user.validator.js';

const router = Router();

router.use(authenticate, requireTenant, requireRoles(ROLES.HOSPITAL_ADMIN));
router.get('/', validate(listUsersSchema), userController.list);
router.post('/', validate(createUserSchema), userController.create);
router.patch('/:id/role', validate(updateUserRoleSchema), userController.updateRole);
router.patch('/:id/status', validate(updateUserStatusSchema), userController.updateStatus);

export default router;
