import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as clinical from '../controllers/clinical.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createExamSchema,
  examByPatientSchema,
  examParamsSchema,
  examResultsSchema,
  examStatusSchema,
  listExamsSchema,
  updateExamSchema,
} from '../validators/clinical.validator.js';

const router = Router();
const read = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.PATIENT] as const;
const write = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE] as const;

router.use(authenticate, requireTenant);
router.get('/pending', requireRoles(...read), clinical.pendingExams);
router.get('/by-patient/:patientId', requireRoles(...read), validate(examByPatientSchema), clinical.examsByPatient);
router.get('/', requireRoles(...read), validate(listExamsSchema), clinical.listExams);
router.post('/', requireRoles(...write), validate(createExamSchema), clinical.createExam);
router.get('/:id', requireRoles(...read), validate(examParamsSchema), clinical.getExam);
router.put('/:id', requireRoles(...write), validate(updateExamSchema), clinical.updateExam);
router.patch('/:id/status', requireRoles(...write), validate(examStatusSchema), clinical.updateExamStatus);
router.patch('/:id/results', requireRoles(...write), validate(examResultsSchema), clinical.addExamResults);
router.delete('/:id', requireRoles(ROLES.HOSPITAL_ADMIN), validate(examParamsSchema), clinical.deleteExam);

export default router;
