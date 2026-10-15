import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as bedController from '../controllers/bed.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  assignBedSchema,
  bedParamsSchema,
  createBedSchema,
  listBedsSchema,
  listOccupationsSchema,
  releaseBedSchema,
  updateBedSchema,
} from '../validators/bed.validator.js';

const router = Router();

router.use(authenticate, requireTenant, requireRoles(ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST));
router.get('/occupations', validate(listOccupationsSchema), bedController.listOccupations);
router.get('/', validate(listBedsSchema), bedController.listBeds);
router.post('/', validate(createBedSchema), bedController.createBed);
router.get('/:id', validate(bedParamsSchema), bedController.getBed);
router.put('/:id', validate(updateBedSchema), bedController.updateBed);
router.delete('/:id', validate(bedParamsSchema), bedController.deleteBed);
router.put('/:id/assign', validate(assignBedSchema), bedController.assignBed);
router.put('/:id/release', validate(releaseBedSchema), bedController.releaseBed);

export default router;
