import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as surgery from '../controllers/surgery.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  actParamsSchema,
  createActSchema,
  createCategorySchema,
  listActsSchema,
  patientHistorySchema,
  priceHistorySchema,
  statsSchema,
  updateActSchema,
} from '../validators/surgery.validator.js';

const router = Router();

router.use(authenticate, requireTenant, requireRoles(ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT, ROLES.RECEPTIONIST));
router.get('/categories', surgery.listCategories);
router.post('/categories', validate(createCategorySchema), surgery.createCategory);
router.get('/acts', validate(listActsSchema), surgery.listActs);
router.post('/acts', validate(createActSchema), surgery.createAct);
router.get('/acts/:id', validate(actParamsSchema), surgery.getAct);
router.patch('/acts/:id', validate(updateActSchema), surgery.updateAct);
router.get('/prices', validate(priceHistorySchema), surgery.priceHistory);
router.get('/changes', surgery.changeHistory);
router.get('/stats', validate(statsSchema), surgery.stats);
router.get('/patients/:patientId/history', validate(patientHistorySchema), surgery.patientHistory);

export default router;
