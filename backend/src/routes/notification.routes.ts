import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as notifications from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  listNotificationsSchema,
  markAllNotificationsSchema,
  notificationParamsSchema,
} from '../validators/notification.validator.js';

const router = Router();
const readers = [
  ROLES.HOSPITAL_ADMIN,
  ROLES.DOCTOR,
  ROLES.RECEPTIONIST,
  ROLES.NURSE,
  ROLES.ACCOUNTANT,
  ROLES.PHARMACIST,
  ROLES.PATIENT,
] as const;

router.use(authenticate, requireTenant, requireRoles(...readers));
router.get('/unread-count', validate(markAllNotificationsSchema), notifications.unreadCount);
router.patch('/read-all', validate(markAllNotificationsSchema), notifications.markAllNotificationsRead);
router.get('/', validate(listNotificationsSchema), notifications.listNotifications);
router.patch('/:id/read', validate(notificationParamsSchema), notifications.markNotificationRead);

export default router;
