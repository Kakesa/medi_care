import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as nursing from '../controllers/nursing.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  nursingCorrectionSchema,
  nursingAdministrationConfirmSchema,
  nursingAdministrationCorrectionSchema,
  nursingAdministrationListSchema,
  nursingAdministrationMissedSchema,
  nursingAdministrationParamsSchema,
  nursingCreateCareSchema,
  nursingListSchema,
  nursingObservationSchema,
  nursingPatientListSchema,
  nursingPatientParamsSchema,
  nursingReportSchema,
  nursingScheduleSchema,
  nursingTreatmentLineSchema,
  nursingThresholdsSchema,
  nursingUpdateCareSchema,
  nursingVitalsListSchema,
  nursingVitalsSchema,
} from '../validators/nursing.validator.js';

const router = Router();
const readers = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE] as const;

router.use(authenticate, requireTenant);
router.get('/dashboard', requireRoles(...readers), nursing.dashboard);
router.get('/patients', requireRoles(...readers), validate(nursingPatientListSchema), nursing.patients);
router.get('/patients/:patientId', requireRoles(...readers), validate(nursingPatientParamsSchema), nursing.patient);
router.get('/care', requireRoles(...readers), validate(nursingListSchema), nursing.care);
router.post('/care', requireRoles(ROLES.NURSE), validate(nursingCreateCareSchema), nursing.createCare);
router.patch('/care/:id/status', requireRoles(ROLES.NURSE), validate(nursingUpdateCareSchema), nursing.updateCare);
router.post('/care/:id/corrections', requireRoles(ROLES.NURSE), validate(nursingCorrectionSchema), nursing.correctCare);
router.get('/vitals', requireRoles(...readers), validate(nursingVitalsListSchema), nursing.vitals);
router.post('/vitals', requireRoles(ROLES.NURSE), validate(nursingVitalsSchema), nursing.createVitals);
router.post('/observations', requireRoles(ROLES.NURSE), validate(nursingObservationSchema), nursing.createObservation);
router.post('/treatment-lines', requireRoles(ROLES.NURSE), validate(nursingTreatmentLineSchema), nursing.addTreatmentLine);
router.post('/schedules', requireRoles(ROLES.NURSE), validate(nursingScheduleSchema), nursing.scheduleAdministrations);
router.get('/administrations', requireRoles(...readers), validate(nursingAdministrationListSchema), nursing.administrations);
router.post('/administrations/:id/confirm', requireRoles(ROLES.NURSE), validate(nursingAdministrationConfirmSchema), nursing.confirmAdministration);
router.post('/administrations/:id/not-administered', requireRoles(ROLES.NURSE), validate(nursingAdministrationMissedSchema), nursing.markAdministrationMissed);
router.post('/administrations/:id/corrections', requireRoles(ROLES.NURSE), validate(nursingAdministrationCorrectionSchema), nursing.correctAdministration);
router.get('/settings', requireRoles(...readers), nursing.settings);
router.patch('/settings', requireRoles(ROLES.HOSPITAL_ADMIN), validate(nursingThresholdsSchema), nursing.updateSettings);
router.get('/reports', requireRoles(...readers), validate(nursingReportSchema), nursing.report);

export default router;
