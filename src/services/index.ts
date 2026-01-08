// ============================================
// Point d'entrée centralisé pour tous les services API
// ============================================

// Configuration
export { API_CONFIG, getAuthToken, setAuthToken, removeAuthToken } from './config';

// HTTP Client
export { httpClient } from './httpClient';

// Services
export { authService } from './authService';
export { patientService } from './patientService';
export { personnelService } from './personnelService';
export { appointmentService } from './appointmentService';
export { consultationService } from './consultationService';
export { receptionService } from './receptionService';
export { examService } from './examService';
export { pharmacyService } from './pharmacyService';
export { billingService } from './billingService';
export { notificationService } from './notificationService';

// Usage example:
// import { patientService, appointmentService } from '@/services';
// 
// const patients = await patientService.getAll();
// const appointments = await appointmentService.getByDate('2024-01-22');
