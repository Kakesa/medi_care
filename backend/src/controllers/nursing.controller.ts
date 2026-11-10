import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as nursing from '../services/nursing.service.js';

function context(req: Request) {
  if (!req.auth || !req.organizationId) {
    throw new ApiError(401, 'Authentification requise', 'UNAUTHENTICATED');
  }
  return { actor: req.auth, organizationId: req.organizationId };
}

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.getNursingDashboard(actor, organizationId));
});

export const patients = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.listNursingPatients(actor, organizationId, req.query as unknown as { page?: number; limit?: number; search?: string }));
});

export const patient = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.getNursingPatient(actor, organizationId, req.params.patientId, req.ip));
});

export const care = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.listNursingCare(actor, organizationId, req.query as unknown as {
    page?: number; limit?: number; patientId?: string; status?: string; date?: Date;
  }));
});

export const createCare = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.status(201).json(await nursing.createNursingCare(actor, organizationId, req.body, req.ip));
});

export const updateCare = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.updateNursingCare(actor, organizationId, req.params.id, req.body, req.ip));
});

export const correctCare = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.correctNursingCare(actor, organizationId, req.params.id, req.body, req.ip));
});

export const vitals = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.listVitalSigns(actor, organizationId, req.query as unknown as { patientId: string; page?: number; limit?: number }));
});

export const createVitals = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.status(201).json(await nursing.createVitalSigns(actor, organizationId, req.body, req.ip));
});

export const createObservation = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.status(201).json(await nursing.createNursingObservation(actor, organizationId, req.body, req.ip));
});

export const administrations = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.getMedicationAdministrationSheet(actor, organizationId, req.query as unknown as { patientId: string; date: string }));
});

export const confirmAdministration = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.confirmMedicationAdministration(actor, organizationId, req.params.id, req.body, req.ip));
});

export const markAdministrationMissed = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.markMedicationAdministrationMissed(actor, organizationId, req.params.id, req.body, req.ip));
});

export const correctAdministration = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.correctMedicationAdministration(actor, organizationId, req.params.id, req.body, req.ip));
});

export const settings = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = context(req);
  res.json(await nursing.getNursingSettings(organizationId));
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.updateNursingSettings(actor, organizationId, req.body, req.ip));
});

export const report = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await nursing.getNursingReport(actor, organizationId, req.query as unknown as { from?: Date; to?: Date }));
});
