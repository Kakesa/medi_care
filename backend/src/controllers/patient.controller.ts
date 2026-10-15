import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as patientService from '../services/patient.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await patientService.listPatients(req.auth!, req.organizationId!, req.query as never);
  res.json(result);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const patient = await patientService.getPatient(req.auth!, req.organizationId!, req.params.id, req.ip);
  res.json(patient);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const patient = await patientService.createPatient(req.auth!, req.organizationId!, req.body, req.ip);
  res.status(201).json(patient);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const patient = await patientService.updatePatient(req.auth!, req.organizationId!, req.params.id, req.body, req.ip);
  res.json(patient);
});

export const archive = asyncHandler(async (req: Request, res: Response) => {
  await patientService.archivePatient(req.auth!, req.organizationId!, req.params.id, req.ip);
  res.json({ success: true, message: 'Dossier archivé' });
});
