import { Router } from 'express';
import authRoutes from './auth.routes.js';
import organizationRoutes from './organization.routes.js';
import userRoutes from './user.routes.js';
import patientRoutes from './patient.routes.js';
import personnelRoutes from './personnel.routes.js';
import appointmentRoutes from './appointment.routes.js';
import consultationRoutes from './consultation.routes.js';
import receptionRoutes from './reception.routes.js';
import examRoutes from './exam.routes.js';
import pharmacyRoutes from './pharmacy.routes.js';
import billingRoutes from './billing.routes.js';
import surgeryRoutes from './surgery.routes.js';
import chargeRoutes from './charge.routes.js';
import wardRoutes from './ward.routes.js';
import bedRoutes from './bed.routes.js';
import notificationRoutes from './notification.routes.js';
import labRoutes from './lab.routes.js';
import prescriptionRoutes from './prescription.routes.js';
import badgeRoutes from './badge.routes.js';
import publicRoutes from './public.routes.js';
import nursingRoutes from './nursing.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, service: 'medicare-api' });
});

router.use('/public', publicRoutes);
router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/users', userRoutes);
router.use('/patients', patientRoutes);
router.use('/personnel', personnelRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/consultations', consultationRoutes);
router.use('/reception', receptionRoutes);
router.use('/exams', examRoutes);
router.use('/pharmacy', pharmacyRoutes);
router.use('/billing', billingRoutes);
router.use('/surgery', surgeryRoutes);
router.use('/charges', chargeRoutes);
router.use('/wards', wardRoutes);
router.use('/beds', bedRoutes);
router.use('/notifications', notificationRoutes);
router.use('/lab', labRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/badges', badgeRoutes);
router.use('/nursing', nursingRoutes);

export default router;
