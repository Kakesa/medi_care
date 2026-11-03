import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as lab from '../services/lab.service.js';
import * as prescriptions from '../services/prescription.service.js';

const org = (req: Request) => req.organizationId!;
const auth = (req: Request) => req.auth!;

export const listLab = asyncHandler(async (req: Request, res: Response) => {
  res.json(await lab.listLabExams(auth(req), org(req), req.query.labStatus as string | undefined));
});
export const getLab = asyncHandler(async (req: Request, res: Response) => {
  res.json(await lab.getLabExam(auth(req), org(req), req.params.id, req.ip));
});
export const orderLab = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await lab.orderLabExams(auth(req), org(req), req.body, req.ip));
});
export const startLab = asyncHandler(async (req: Request, res: Response) => {
  res.json(await lab.startLabExam(auth(req), org(req), req.params.id, req.ip));
});
export const draftLab = asyncHandler(async (req: Request, res: Response) => {
  res.json(await lab.saveLabDraft(auth(req), org(req), req.params.id, req.body, req.ip));
});
export const submitLab = asyncHandler(async (req: Request, res: Response) => {
  res.json(await lab.submitLabExam(auth(req), org(req), req.params.id, req.ip));
});
export const validateLab = asyncHandler(async (req: Request, res: Response) => {
  res.json(await lab.decideLabExam(auth(req), org(req), req.params.id, 'VALIDE', req.body.comment, req.ip));
});
export const correctLab = asyncHandler(async (req: Request, res: Response) => {
  res.json(await lab.decideLabExam(auth(req), org(req), req.params.id, 'CORRECTION_DEMANDEE', req.body.comment, req.ip));
});
export const rejectLab = asyncHandler(async (req: Request, res: Response) => {
  res.json(await lab.decideLabExam(auth(req), org(req), req.params.id, 'REJETE', req.body.comment, req.ip));
});
export const cancelLab = asyncHandler(async (req: Request, res: Response) => {
  res.json(await lab.cancelLabExam(auth(req), org(req), req.params.id, req.ip));
});

export const listPrescriptions = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.listPrescriptions(auth(req), org(req), req.query.patientId as string | undefined));
});
export const createPrescription = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await prescriptions.createPrescription(auth(req), org(req), req.body, req.ip));
});
export const validatePrescription = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.validatePrescription(auth(req), org(req), req.params.id, req.ip));
});
export const preparePrescription = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.preparePrescription(auth(req), org(req), req.params.id, req.ip));
});
export const dispensePrescription = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.dispensePrescription(auth(req), org(req), req.params.id, req.body, req.ip));
});
export const unavailablePrescription = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.markUnavailable(auth(req), org(req), req.params.id, req.body, req.ip));
});
export const closePrescription = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.closePrescription(auth(req), org(req), req.params.id, req.ip));
});
