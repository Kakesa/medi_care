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
  res.json(await lab.submitLabExam(auth(req), org(req), req.params.id, req.body, req.ip));
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
  res.json(await prescriptions.listPrescriptions(auth(req), org(req), {
    patientId: req.query.patientId as string | undefined,
    consultationId: req.query.consultationId as string | undefined,
  }));
});
export const createPrescription = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await prescriptions.createPrescription(auth(req), org(req), req.body, req.ip));
});
export const saveConsultationPrescription = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.saveConsultationPrescription(auth(req), org(req), req.body, req.ip));
});
export const validatePrescription = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.validatePrescription(auth(req), org(req), req.params.id, req.ip));
});
export const listMyPrescriptions = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.listMyPrescriptions(auth(req), org(req), req.query as {
    billingStatus?: string;
    pharmacyStatus?: string;
    filter?: string;
  }));
});
export const getMyPrescription = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.getMyPrescription(auth(req), org(req), req.params.id));
});
export const listPrescriptionAbbreviations = asyncHandler(async (req: Request, res: Response) => {
  const { listMergedAbbreviations } = await import('../services/abbreviation.service.js');
  const items = await listMergedAbbreviations(org(req));
  res.json({
    items: items.map((item) => ({
      code: item.code,
      meaning: item.meaning,
      kind: item.kind,
      unit: item.unit || '',
      variants: item.variants,
      active: item.active,
    })),
  });
});
export const previewPrescriptionLine = asyncHandler(async (req: Request, res: Response) => {
  const { previewPrescriptionLine } = await import('../services/abbreviation.service.js');
  res.json(await previewPrescriptionLine(org(req), req.body || {}));
});
export const getPrescriptionQuote = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.getPrescriptionQuoteDto(auth(req), org(req), req.params.id, req.ip));
});
export const refreshPrescriptionQuote = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.refreshPrescriptionQuoteDto(auth(req), org(req), req.params.id, req.ip));
});
export const confirmPrescriptionQuote = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.confirmQuoteDto(auth(req), org(req), req.params.id, req.body || {}, req.ip));
});
export const cancelPrescriptionBilling = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.cancelBillingDto(auth(req), org(req), req.params.id, req.body || {}, req.ip));
});
export const updatePrescriptionItemStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(await prescriptions.updatePrescriptionItemStatus(auth(req), org(req), req.params.id, req.params.itemId, req.body, req.ip));
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
