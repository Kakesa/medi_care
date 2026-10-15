import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as organizationController from '../controllers/organization.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createOrganizationSchema,
  listOrganizationsSchema,
  organizationParamsSchema,
  updateOrganizationSchema,
} from '../validators/organization.validator.js';
import { createOrganizationUserSchema } from '../validators/user.validator.js';

const router = Router();

router.use(authenticate, requireRoles(ROLES.SUPERADMIN));
router.get('/', validate(listOrganizationsSchema), organizationController.list);
router.post('/', validate(createOrganizationSchema), organizationController.create);
router.get('/:id', validate(organizationParamsSchema), organizationController.getById);
router.patch('/:id', validate(updateOrganizationSchema), organizationController.update);
router.post('/:id/users', validate(createOrganizationUserSchema), organizationController.createUser);

export default router;
