import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as personnelService from '../services/personnel.service.js';
import * as appointmentService from '../services/appointment.service.js';
import * as consultationService from '../services/consultation.service.js';
import * as receptionService from '../services/reception.service.js';
import * as examService from '../services/exam.service.js';
import * as pharmacyService from '../services/pharmacy.service.js';
import * as billingService from '../services/billing.service.js';

const org = (req: Request) => req.organizationId!;
const auth = (req: Request) => req.auth!;

export const listPersonnel = asyncHandler(async (req: Request, res: Response) => {
  res.json(await personnelService.listPersonnel(org(req), req.query as never));
});
export const listDoctors = asyncHandler(async (req: Request, res: Response) => {
  res.json(await personnelService.listDoctors(org(req)));
});
export const getPersonnel = asyncHandler(async (req: Request, res: Response) => {
  res.json(await personnelService.getPersonnel(auth(req), org(req), req.params.id, req.ip));
});
export const createPersonnel = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await personnelService.createPersonnel(auth(req), org(req), req.body, req.ip));
});
export const updatePersonnel = asyncHandler(async (req: Request, res: Response) => {
  res.json(await personnelService.updatePersonnel(auth(req), org(req), req.params.id, req.body, req.ip));
});
export const updatePersonnelStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(await personnelService.updatePersonnelStatus(auth(req), org(req), req.params.id, req.body.status, req.ip));
});
export const archivePersonnel = asyncHandler(async (req: Request, res: Response) => {
  await personnelService.archivePersonnel(auth(req), org(req), req.params.id, req.ip);
  res.json({ success: true, message: 'Fiche archivée' });
});

export const listAppointments = asyncHandler(async (req: Request, res: Response) => {
  res.json(await appointmentService.listAppointments(auth(req), org(req), req.query as never));
});
export const appointmentsByDate = asyncHandler(async (req: Request, res: Response) => {
  res.json(await appointmentService.appointmentsByDate(auth(req), org(req), req.params.date));
});
export const appointmentsByDoctor = asyncHandler(async (req: Request, res: Response) => {
  res.json(await appointmentService.appointmentsByDoctor(auth(req), org(req), req.params.doctorId, req.ip));
});
export const appointmentsByPatient = asyncHandler(async (req: Request, res: Response) => {
  res.json(await appointmentService.appointmentsByPatient(auth(req), org(req), req.params.patientId, req.ip));
});
export const getAppointment = asyncHandler(async (req: Request, res: Response) => {
  res.json(await appointmentService.getAppointment(auth(req), org(req), req.params.id, req.ip));
});
export const createAppointment = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await appointmentService.createAppointment(auth(req), org(req), req.body, req.ip));
});
export const updateAppointment = asyncHandler(async (req: Request, res: Response) => {
  res.json(await appointmentService.updateAppointment(auth(req), org(req), req.params.id, req.body, req.ip));
});
export const updateAppointmentStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(await appointmentService.updateAppointmentStatus(auth(req), org(req), req.params.id, req.body.status, req.ip));
});
export const deleteAppointment = asyncHandler(async (req: Request, res: Response) => {
  await appointmentService.deleteAppointment(auth(req), org(req), req.params.id, req.ip);
  res.json({ success: true, message: 'Rendez-vous supprimé' });
});

export const listConsultations = asyncHandler(async (req: Request, res: Response) => {
  res.json(await consultationService.listConsultations(auth(req), org(req), req.query as never));
});
export const consultationsByDoctor = asyncHandler(async (req: Request, res: Response) => {
  res.json(await consultationService.consultationsByDoctor(auth(req), org(req), req.params.doctorId));
});
export const consultationsByPatient = asyncHandler(async (req: Request, res: Response) => {
  res.json(await consultationService.consultationsByPatient(auth(req), org(req), req.params.patientId, req.ip));
});
export const getConsultation = asyncHandler(async (req: Request, res: Response) => {
  res.json(await consultationService.getConsultation(auth(req), org(req), req.params.id, req.ip));
});
export const createConsultation = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await consultationService.createConsultation(auth(req), org(req), req.body, req.ip));
});
export const updateConsultation = asyncHandler(async (req: Request, res: Response) => {
  res.json(await consultationService.updateConsultation(auth(req), org(req), req.params.id, req.body, req.ip));
});
export const completeConsultation = asyncHandler(async (req: Request, res: Response) => {
  res.json(await consultationService.completeConsultation(auth(req), org(req), req.params.id, req.ip));
});
export const deleteConsultation = asyncHandler(async (req: Request, res: Response) => {
  await consultationService.deleteConsultation(auth(req), org(req), req.params.id, req.ip);
  res.json({ success: true, message: 'Consultation supprimée' });
});

export const listReception = asyncHandler(async (req: Request, res: Response) => {
  res.json(await receptionService.listReception(org(req), req.query as never));
});
export const waitingReception = asyncHandler(async (req: Request, res: Response) => {
  res.json(await receptionService.waitingReception(org(req)));
});
export const receptionStats = asyncHandler(async (req: Request, res: Response) => {
  res.json(await receptionService.todayReceptionStats(org(req)));
});
export const getReception = asyncHandler(async (req: Request, res: Response) => {
  res.json(await receptionService.getReception(auth(req), org(req), req.params.id, req.ip));
});
export const createReception = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await receptionService.createReception(auth(req), org(req), req.body, req.ip));
});
export const updateReception = asyncHandler(async (req: Request, res: Response) => {
  res.json(await receptionService.updateReception(auth(req), org(req), req.params.id, req.body, req.ip));
});
export const updateReceptionStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(await receptionService.updateReceptionStatus(auth(req), org(req), req.params.id, req.body.status, req.body.assignedDoctor, req.ip));
});
export const assignReception = asyncHandler(async (req: Request, res: Response) => {
  res.json(await receptionService.assignReceptionDoctor(auth(req), org(req), req.params.id, req.body.doctorId, req.ip));
});
export const cancelReception = asyncHandler(async (req: Request, res: Response) => {
  await receptionService.cancelReception(auth(req), org(req), req.params.id, req.ip);
  res.json({ success: true, message: 'Passage annulé' });
});

export const listExams = asyncHandler(async (req: Request, res: Response) => {
  res.json(await examService.listExams(auth(req), org(req), req.query as never));
});
export const pendingExams = asyncHandler(async (req: Request, res: Response) => {
  res.json(await examService.pendingExams(auth(req), org(req)));
});
export const examsByPatient = asyncHandler(async (req: Request, res: Response) => {
  res.json(await examService.examsByPatient(auth(req), org(req), req.params.patientId, req.ip));
});
export const getExam = asyncHandler(async (req: Request, res: Response) => {
  res.json(await examService.getExam(auth(req), org(req), req.params.id, req.ip));
});
export const createExam = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await examService.createExam(auth(req), org(req), req.body, req.ip));
});
export const updateExam = asyncHandler(async (req: Request, res: Response) => {
  res.json(await examService.updateExam(auth(req), org(req), req.params.id, req.body, req.ip));
});
export const updateExamStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(await examService.updateExamStatus(auth(req), org(req), req.params.id, req.body.status, req.ip));
});
export const addExamResults = asyncHandler(async (req: Request, res: Response) => {
  res.json(await examService.addExamResults(auth(req), org(req), req.params.id, req.body.results, req.body.files, req.ip));
});
export const deleteExam = asyncHandler(async (req: Request, res: Response) => {
  await examService.deleteExam(auth(req), org(req), req.params.id, req.ip);
  res.json({ success: true, message: 'Examen supprimé' });
});

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  res.json(await pharmacyService.listProducts(org(req), req.query as never));
});
export const lowStock = asyncHandler(async (req: Request, res: Response) => {
  res.json(await pharmacyService.lowStockProducts(org(req)));
});
export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  res.json(await pharmacyService.getProduct(auth(req), org(req), req.params.id, req.ip));
});
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await pharmacyService.createProduct(auth(req), org(req), req.body, req.ip));
});
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  res.json(await pharmacyService.updateProduct(auth(req), org(req), req.params.id, req.body, req.ip));
});
export const updateStock = asyncHandler(async (req: Request, res: Response) => {
  res.json(await pharmacyService.updateStock(auth(req), org(req), req.params.id, req.body.quantity, req.ip));
});
export const archiveProduct = asyncHandler(async (req: Request, res: Response) => {
  await pharmacyService.archiveProduct(auth(req), org(req), req.params.id, req.ip);
  res.json({ success: true, message: 'Produit archivé' });
});
export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  res.json(await pharmacyService.listOrders(org(req), req.query as never));
});
export const pendingOrders = asyncHandler(async (req: Request, res: Response) => {
  res.json(await pharmacyService.pendingOrders(org(req)));
});
export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  res.json(await pharmacyService.getOrder(auth(req), org(req), req.params.id, req.ip));
});
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await pharmacyService.createOrder(auth(req), org(req), req.body, req.ip));
});
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(await pharmacyService.updateOrderStatus(auth(req), org(req), req.params.id, req.body.status, req.ip));
});
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  await pharmacyService.cancelOrder(auth(req), org(req), req.params.id, req.ip);
  res.json({ success: true, message: 'Commande annulée' });
});

export const billingPatients = asyncHandler(async (req: Request, res: Response) => {
  res.json(await billingService.billingPatients(org(req)));
});
export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  res.json(await billingService.listInvoices(org(req), req.query as never));
});
export const invoiceStats = asyncHandler(async (req: Request, res: Response) => {
  res.json(await billingService.invoiceStats(org(req)));
});
export const generateNumber = asyncHandler(async (req: Request, res: Response) => {
  res.json(await billingService.generateInvoiceNumber(org(req)));
});
export const overdueInvoices = asyncHandler(async (req: Request, res: Response) => {
  res.json(await billingService.overdueInvoices(org(req)));
});
export const invoicesByPatient = asyncHandler(async (req: Request, res: Response) => {
  res.json(await billingService.invoicesByPatient(auth(req), org(req), req.params.patientId, req.ip));
});
export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  res.json(await billingService.getInvoice(auth(req), org(req), req.params.id, req.ip));
});
export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await billingService.createInvoice(auth(req), org(req), req.body, req.ip));
});
export const updateInvoice = asyncHandler(async (req: Request, res: Response) => {
  res.json(await billingService.updateInvoice(auth(req), org(req), req.params.id, req.body, req.ip));
});
export const payInvoice = asyncHandler(async (req: Request, res: Response) => {
  res.json(await billingService.payInvoice(auth(req), org(req), req.params.id, req.body.paymentMethod, req.ip));
});
export const cancelInvoice = asyncHandler(async (req: Request, res: Response) => {
  res.json(await billingService.cancelInvoice(auth(req), org(req), req.params.id, req.ip));
});
export const deleteInvoice = asyncHandler(async (req: Request, res: Response) => {
  await billingService.deleteInvoice(auth(req), org(req), req.params.id, req.ip);
  res.json({ success: true, message: 'Facture annulée' });
});
