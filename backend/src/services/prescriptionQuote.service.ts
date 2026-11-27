import mongoose from 'mongoose';
import { DEFAULT_PHARMACY_ABBREVIATIONS, mergeAbbreviations, type PharmacyAbbreviationDef } from '../pharmacy/abbreviations.defaults.js';
import { PharmacyAbbreviation } from '../models/PharmacyAbbreviation.js';
import { PharmacyProduct } from '../models/PharmacyProduct.js';
import { Prescription } from '../models/Prescription.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned } from './access.service.js';
import { organizationCurrency } from './catalog.service.js';
import {
  buildLineQuote,
  matchCatalogProduct,
  parsePrescriptionLine,
  summarizeQuote,
  type CatalogProductLike,
} from './prescriptionParse.logic.js';
import { recordAudit } from './audit.service.js';

async function loadAbbreviations(organizationId: string): Promise<PharmacyAbbreviationDef[]> {
  const rows = await PharmacyAbbreviation.find({ organizationId }).limit(500);
  const overrides: PharmacyAbbreviationDef[] = rows.map((row) => ({
    code: row.code,
    meaning: row.meaning,
    kind: row.kind as PharmacyAbbreviationDef['kind'],
    unit: row.unit || undefined,
    variants: row.variants || [],
    active: row.active !== false,
  }));
  return mergeAbbreviations(DEFAULT_PHARMACY_ABBREVIATIONS, overrides);
}

async function loadCatalog(organizationId: string): Promise<CatalogProductLike[]> {
  const rows = await PharmacyProduct.find({
    organizationId,
    archivedAt: null,
    active: { $ne: false },
  }).select('name genericName dosage form unit saleUnit price quantity active archivedAt').limit(2000);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    genericName: row.genericName,
    dosage: row.dosage,
    form: row.form,
    unit: row.unit,
    saleUnit: row.saleUnit,
    price: row.price,
    quantity: row.quantity,
    active: row.active,
    archivedAt: row.archivedAt,
  }));
}

function lineRawText(item: {
  medication: string;
  dosage: string;
  posology: string;
  duration: string;
  instructions?: string;
}) {
  const sPart = [item.dosage, item.posology]
    .filter((part) => part && part !== 'Selon prescription')
    .join(' ');
  const extras = [
    item.duration && item.duration !== 'Selon prescription' ? item.duration : '',
    item.instructions || '',
  ].filter(Boolean).join(' ');
  return [
    `R/ ${item.medication}`,
    sPart ? `S/ ${sPart}` : '',
    extras,
  ].filter(Boolean).join(' ').trim();
}

export async function analyzePrescriptionDocument(
  organizationId: string,
  row: InstanceType<typeof Prescription>,
) {
  const [abbreviations, catalog, currency] = await Promise.all([
    loadAbbreviations(organizationId),
    loadCatalog(organizationId),
    organizationCurrency(organizationId),
  ]);

  const quotes: Array<{ lineTotal: number | null; billable: boolean }> = [];

  for (const item of row.items) {
    const rawText = lineRawText(item);
    const parsed = parsePrescriptionLine({
      rawText,
      medication: item.medication,
      dosage: item.dosage,
      posology: item.posology,
      duration: item.duration,
      quantityPrescribed: item.quantityPrescribed,
      instructions: item.instructions,
    }, abbreviations);

    const match = matchCatalogProduct(parsed, catalog, abbreviations);
    const product = match.productId ? catalog.find((entry) => entry.id === match.productId) : null;
    const quote = buildLineQuote(parsed, match, product);
    quotes.push(quote);

    if (parsed.quantityProposed != null && parsed.quantityProposed > 0) {
      // Même en anomalie DR ≠ posologie, on propose la qty calculée (ex. 6) ; l’alerte reste en analysis.
      item.quantityPrescribed = Math.max(item.quantityDispensed || 0, parsed.quantityProposed);
    }

    if (parsed.form && !item.form) item.form = parsed.form.slice(0, 40);

    item.analysis = {
      rawText: parsed.rawText || rawText,
      medicationName: parsed.medicationName,
      dosageAmount: parsed.dosage.amount,
      dosageUnit: parsed.dosage.unit,
      form: parsed.form,
      formUnit: parsed.formUnit,
      quantityMarked: parsed.quantityMarked,
      dosePerDay: parsed.dosePerDay,
      durationDays: parsed.durationDays,
      quantityFromPosology: parsed.quantityFromPosology,
      quantityProposed: parsed.quantityProposed,
      quantityValidated: null,
      posologyText: parsed.posologyText,
      instructions: parsed.instructions,
      confidence: parsed.confidence,
      needsPharmacistValidation: parsed.needsPharmacistValidation,
      alerts: quote.alerts,
      matchedProductId: match.productId ? new mongoose.Types.ObjectId(match.productId) : null,
      matchedProductName: match.productName,
      matchConfidence: match.confidence,
      matchCandidates: match.candidates,
      unitPrice: quote.unitPrice,
      lineTotal: quote.lineTotal,
      billable: quote.billable,
      validationStatus: parsed.needsPharmacistValidation || match.confidence === 'none' || match.confidence === 'low'
        ? 'needs_review'
        : quote.billable ? 'approved' : 'pending',
      analyzedAt: new Date(),
    } as typeof item.analysis;
  }

  const summary = summarizeQuote(quotes);
  row.quoteCurrency = currency as typeof row.quoteCurrency;
  row.quoteTotal = summary.total;
  row.quotePendingLines = summary.pendingCount;
  row.quotedAt = new Date();
  if (!row.items.length) row.quoteStatus = 'none';
  else if (summary.pendingCount === 0) row.quoteStatus = 'ready';
  else if (summary.billableCount > 0) row.quoteStatus = 'partial';
  else row.quoteStatus = 'pending_review';

  if (row.billingStatus === 'none' && row.items.length) {
    row.billingStatus = 'quoted';
  }

  return row;
}

export async function applyPrescriptionQuote(
  organizationId: string,
  prescriptionId: string,
) {
  const row = await Prescription.findOne({ _id: prescriptionId, organizationId });
  if (!row) return null;
  await analyzePrescriptionDocument(organizationId, row);
  await row.save();
  return row;
}

export async function refreshPrescriptionQuote(
  actor: AuthContext,
  organizationId: string,
  id: string,
  ip?: string,
) {
  const row = await requireOwned(Prescription, id, organizationId, actor, 'prescription', ip);
  if (row.status !== 'validated' && actor.role !== 'HOSPITAL_ADMIN') {
    // Allow refresh on draft for admin/doctor preview; pharmacist only validated via list filter elsewhere
  }
  await analyzePrescriptionDocument(organizationId, row);
  row.history = [
    ...(row.history || []),
    {
      at: new Date(),
      userName: actor.role,
      action: 'QUOTE_REFRESH',
      comment: `Total estimé ${row.quoteTotal} · ${row.quotePendingLines} ligne(s) en revue`,
    },
  ];
  await row.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PRESCRIPTION_QUOTE_REFRESHED',
    resourceType: 'prescription',
    resourceId: row.id,
    success: true,
    ip,
    metadata: { quoteTotal: row.quoteTotal, quoteStatus: row.quoteStatus },
  });
  return row;
}

export function analysisToDto(analysis: Record<string, unknown> | null | undefined) {
  if (!analysis) return undefined;
  const matched = analysis.matchedProductId as { toString(): string } | string | null | undefined;
  return {
    rawText: String(analysis.rawText || ''),
    medicationName: String(analysis.medicationName || ''),
    dosageAmount: analysis.dosageAmount == null ? null : Number(analysis.dosageAmount),
    dosageUnit: String(analysis.dosageUnit || ''),
    form: String(analysis.form || ''),
    formUnit: String(analysis.formUnit || ''),
    quantityMarked: analysis.quantityMarked == null ? null : Number(analysis.quantityMarked),
    dosePerDay: analysis.dosePerDay == null ? null : Number(analysis.dosePerDay),
    durationDays: analysis.durationDays == null ? null : Number(analysis.durationDays),
    quantityFromPosology: analysis.quantityFromPosology == null ? null : Number(analysis.quantityFromPosology),
    quantityProposed: analysis.quantityProposed == null ? null : Number(analysis.quantityProposed),
    quantityValidated: analysis.quantityValidated == null ? null : Number(analysis.quantityValidated),
    posologyText: String(analysis.posologyText || ''),
    instructions: String(analysis.instructions || ''),
    confidence: analysis.confidence || 'low',
    needsPharmacistValidation: Boolean(analysis.needsPharmacistValidation),
    alerts: Array.isArray(analysis.alerts) ? analysis.alerts : [],
    matchedProductId: matched ? matched.toString() : null,
    matchedProductName: String(analysis.matchedProductName || ''),
    matchConfidence: analysis.matchConfidence || 'none',
    matchCandidates: Array.isArray(analysis.matchCandidates) ? analysis.matchCandidates : [],
    unitPrice: analysis.unitPrice == null ? null : Number(analysis.unitPrice),
    lineTotal: analysis.lineTotal == null ? null : Number(analysis.lineTotal),
    billable: Boolean(analysis.billable),
    validationStatus: analysis.validationStatus || 'pending',
    analyzedAt: analysis.analyzedAt || null,
  };
}

export async function getPrescriptionQuote(
  actor: AuthContext,
  organizationId: string,
  id: string,
  ip?: string,
) {
  const row = await requireOwned(Prescription, id, organizationId, actor, 'prescription', ip);
  if (!row.quotedAt) {
    await analyzePrescriptionDocument(organizationId, row);
    await row.save();
  }
  return row;
}
