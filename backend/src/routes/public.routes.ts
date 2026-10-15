import { Router } from 'express';
import * as organizations from '../controllers/organization.controller.js';

const router = Router();

router.get('/organizations', organizations.publicOrganizations);
router.get('/organizations/:slug/doctors', organizations.publicDoctors);

export default router;
