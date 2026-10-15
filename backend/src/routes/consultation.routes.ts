import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as clinical from '../controllers/clinical.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  consultationByDoctorSchema,
  consultationByPatientSchema,
  consultationParamsSchema,
  createConsultationSchema,
  listConsultationsSchema,
  updateConsultationSchema,
} from '../validators/clinical.validator.js';

const router = Router();
const read = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.PATIENT] as const;
const write = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR] as const;

router.use(authenticate, requireTenant);
router.get('/by-doctor/:doctorId', requireRoles(...read), validate(consultationByDoctorSchema), clinical.consultationsByDoctor);
router.get('/by-patient/:patientId', requireRoles(...read), validate(consultationByPatientSchema), clinical.consultationsByPatient);
router.get('/', requireRoles(...read), validate(listConsultationsSchema), clinical.listConsultations);
router.post('/', requireRoles(...write), validate(createConsultationSchema), clinical.createConsultation);
router.get('/:id', requireRoles(...read), validate(consultationParamsSchema), clinical.getConsultation);
router.put('/:id', requireRoles(...write), validate(updateConsultationSchema), clinical.updateConsultation);
router.patch('/:id/complete', requireRoles(...write), validate(consultationParamsSchema), clinical.completeConsultation);
router.delete('/:id', requireRoles(ROLES.HOSPITAL_ADMIN), validate(consultationParamsSchema), clinical.deleteConsultation);

export default router;
