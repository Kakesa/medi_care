import { Router } from 'express';
import { ROLES } from '../config/permissions.js';
import * as clinical from '../controllers/clinical.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { requireTenant } from '../middlewares/tenant.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  appointmentByDateSchema,
  appointmentByDoctorSchema,
  appointmentByPatientSchema,
  appointmentParamsSchema,
  appointmentResponseSchema,
  appointmentStatusSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
} from '../validators/clinical.validator.js';

const router = Router();
const read = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PATIENT] as const;
const write = [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST] as const;

router.use(authenticate, requireTenant);
router.get('/by-date/:date', requireRoles(...read), validate(appointmentByDateSchema), clinical.appointmentsByDate);
router.get('/by-doctor/:doctorId', requireRoles(...read), validate(appointmentByDoctorSchema), clinical.appointmentsByDoctor);
router.get('/by-patient/:patientId', requireRoles(...read), validate(appointmentByPatientSchema), clinical.appointmentsByPatient);
router.get('/', requireRoles(...read), validate(listAppointmentsSchema), clinical.listAppointments);
router.post('/', requireRoles(...write), validate(createAppointmentSchema), clinical.createAppointment);
router.get('/:id', requireRoles(...read), validate(appointmentParamsSchema), clinical.getAppointment);
router.put('/:id', requireRoles(...write), validate(updateAppointmentSchema), clinical.updateAppointment);
router.patch('/:id/status', requireRoles(...write), validate(appointmentStatusSchema), clinical.updateAppointmentStatus);
router.patch('/:id/accept', requireRoles(ROLES.PATIENT), validate(appointmentResponseSchema), clinical.acceptAppointment);
router.patch('/:id/decline', requireRoles(ROLES.PATIENT), validate(appointmentResponseSchema), clinical.declineAppointment);
router.delete('/:id', requireRoles(...write), validate(appointmentParamsSchema), clinical.deleteAppointment);

export default router;
