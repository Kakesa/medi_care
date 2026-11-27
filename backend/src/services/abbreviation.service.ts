import {
  DEFAULT_PHARMACY_ABBREVIATIONS,
  mergeAbbreviations,
  type PharmacyAbbreviationDef,
} from '../pharmacy/abbreviations.defaults.js';
import { PharmacyAbbreviation } from '../models/PharmacyAbbreviation.js';
import { parsePrescriptionLine } from './prescriptionParse.logic.js';

export async function listMergedAbbreviations(organizationId: string): Promise<PharmacyAbbreviationDef[]> {
  const rows = await PharmacyAbbreviation.find({ organizationId }).limit(500);
  const overrides: PharmacyAbbreviationDef[] = rows.map((row) => ({
    code: row.code,
    meaning: row.meaning,
    kind: row.kind as PharmacyAbbreviationDef['kind'],
    unit: row.unit || undefined,
    variants: row.variants || [],
    active: row.active !== false,
  }));
  return mergeAbbreviations(DEFAULT_PHARMACY_ABBREVIATIONS, overrides)
    .filter((item) => item.active)
    .sort((a, b) => a.code.localeCompare(b.code, 'fr'));
}

export async function previewPrescriptionLine(
  organizationId: string,
  input: {
    rawText?: string;
    medication?: string;
    dosage?: string;
    posology?: string;
    duration?: string;
    quantityPrescribed?: number;
    instructions?: string;
  },
) {
  const abbreviations = await listMergedAbbreviations(organizationId);
  const parsed = parsePrescriptionLine(input, abbreviations);
  return {
    abbreviationsUsed: abbreviations.filter((item) => item.kind === 'form' || item.kind === 'frequency' || item.kind === 'duration' || item.kind === 'marker')
      .map((item) => ({ code: item.code, meaning: item.meaning, variants: item.variants, unit: item.unit || '' })),
    parsed: {
      rawText: parsed.rawText,
      medicationName: parsed.medicationName,
      dosage: parsed.dosage,
      form: parsed.form,
      formUnit: parsed.formUnit,
      quantityMarked: parsed.quantityMarked,
      dosePerDay: parsed.dosePerDay,
      durationDays: parsed.durationDays,
      quantityFromPosology: parsed.quantityFromPosology,
      quantityProposed: parsed.quantityProposed,
      posologyText: parsed.posologyText,
      instructions: parsed.instructions,
      confidence: parsed.confidence,
      needsPharmacistValidation: parsed.needsPharmacistValidation,
      alerts: parsed.alerts,
    },
  };
}
