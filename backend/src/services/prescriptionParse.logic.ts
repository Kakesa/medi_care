import {
  DEFAULT_PHARMACY_ABBREVIATIONS,
  formsCompatible,
  mergeAbbreviations,
  normalizeAbbrevToken,
  resolveFormUnit,
  type PharmacyAbbreviationDef,
} from '../pharmacy/abbreviations.defaults.js';

export type ParseAlertCode =
  | 'quantity_ambiguous'
  | 'quantity_unknown'
  | 'product_not_found'
  | 'multiple_matches'
  | 'dosage_mismatch'
  | 'form_mismatch'
  | 'price_missing'
  | 'needs_review';

export type ParsedDosage = {
  amount: number | null;
  unit: string;
  raw: string;
};

export type ParsedPrescriptionLine = {
  rawText: string;
  medicationName: string;
  dosage: ParsedDosage;
  form: string;
  formUnit: string;
  quantityMarked: number | null;
  dosePerDay: number | null;
  durationDays: number | null;
  quantityFromPosology: number | null;
  quantityProposed: number | null;
  posologyText: string;
  instructions: string;
  alerts: Array<{ code: ParseAlertCode; message: string }>;
  confidence: 'high' | 'medium' | 'low';
  needsPharmacistValidation: boolean;
};

export type CatalogProductLike = {
  id: string;
  name: string;
  genericName?: string;
  dosage?: string;
  form?: string;
  unit?: string;
  saleUnit?: string;
  price: number;
  quantity: number;
  active?: boolean;
  archivedAt?: string | Date | null;
};

export type CatalogMatch = {
  productId: string | null;
  productName: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  alerts: Array<{ code: ParseAlertCode; message: string }>;
  candidates: Array<{ id: string; name: string }>;
};

export type LineQuote = {
  unitPrice: number | null;
  quantityProposed: number | null;
  quantityValidated: number | null;
  lineTotal: number | null;
  currencyHint?: string;
  billable: boolean;
  alerts: Array<{ code: ParseAlertCode; message: string }>;
};

function collapseSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeText(value: string) {
  return collapseSpaces(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function stripMarkers(value: string) {
  return value.replace(/^\s*r\s*\/\s*/i, '').replace(/^\s*s\s*\/\s*/i, '').trim();
}

function splitRS(raw: string): { rPart: string; sPart: string } {
  const text = collapseSpaces(raw);
  const match = text.match(/^(.*?)\s+s\s*\/\s*(.*)$/i);
  if (match) return { rPart: stripMarkers(match[1]), sPart: stripMarkers(match[2]) };
  return { rPart: stripMarkers(text), sPart: '' };
}

function parseDosageToken(raw: string): ParsedDosage | null {
  const match = raw.match(/^(\d+(?:[.,]\d+)?)\s*(mg|g|mcg|µg|ug|ml|ui|%|mmol)?$/i);
  if (!match) return null;
  return {
    amount: Number(String(match[1]).replace(',', '.')),
    unit: (match[2] || '').toLowerCase().replace('µg', 'mcg').replace('ug', 'mcg'),
    raw: match[0],
  };
}

function extractDosageFromText(text: string): { dosage: ParsedDosage | null; rest: string } {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(mg|g|mcg|µg|ug|ml|ui|%|mmol)\b/i);
  if (!match || match.index == null) return { dosage: null, rest: text };
  const dosage = parseDosageToken(match[0]);
  const rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`.replace(/\s+/g, ' ').trim();
  return { dosage, rest };
}

function extractMarkedQuantity(text: string): { quantity: number | null; rest: string } {
  const match = text.match(/\b(?:dr|qte|qté|qty)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\b/i);
  if (!match || match.index == null) return { quantity: null, rest: text };
  const quantity = Number(String(match[1]).replace(',', '.'));
  const rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`.replace(/\s+/g, ' ').trim();
  return { quantity: Number.isFinite(quantity) ? quantity : null, rest };
}

function extractFormToken(text: string, abbreviations: PharmacyAbbreviationDef[]): {
  form: string;
  formUnit: string;
  rest: string;
} {
  const tokens = text.split(/\s+/).filter(Boolean);
  for (let index = 0; index < tokens.length; index += 1) {
    const resolved = resolveFormUnit(tokens[index], abbreviations);
    if (!resolved) continue;
    const rest = [...tokens.slice(0, index), ...tokens.slice(index + 1)].join(' ').trim();
    return { form: resolved.meaning, formUnit: resolved.unit, rest };
  }
  return { form: '', formUnit: '', rest: text };
}

function extractDosePerDay(sPart: string, abbreviations: PharmacyAbbreviationDef[]): {
  dosePerDay: number | null;
  rest: string;
} {
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*([a-zA-ZéÉèÈêÊçÇûÛùÙïÏöÖäÄâÂàÀœŒ]+)?\s*(?:\/\s*j|par\s*j(?:our)?|die)\b/i,
    /(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(?:\/\s*j|par\s*j(?:our)?)\b/i,
  ];
  for (const pattern of patterns) {
    const match = sPart.match(pattern);
    if (!match || match.index == null) continue;
    const amount = Number(String(match[1]).replace(',', '.'));
    if (match[2]) {
      const form = resolveFormUnit(match[2], abbreviations);
      if (!form && normalizeAbbrevToken(match[2]).length > 1) {
        // keep scanning if token looks unrelated
      }
    }
    const rest = `${sPart.slice(0, match.index)} ${sPart.slice(match.index + match[0].length)}`.replace(/\s+/g, ' ').trim();
    return { dosePerDay: Number.isFinite(amount) ? amount : null, rest };
  }
  return { dosePerDay: null, rest: sPart };
}

function extractDurationDays(text: string): { days: number | null; rest: string } {
  const patterns = [
    /\|\|\s*(\d+(?:[.,]\d+)?)\s*j(?:ours?)?\b/i,
    /\bpendant\s+(\d+(?:[.,]\d+)?)\s*j(?:ours?)?\b/i,
    /\bdurée\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*j(?:ours?)?\b/i,
    /\b(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*j(?:ours?)?\b/i,
    /\b(\d+(?:[.,]\d+)?)\s*j(?:ours?)?\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match || match.index == null) continue;
    // Avoid treating "après 72h" style as duration-in-days when unit is h
    if (/\d+\s*h\b/i.test(match[0]) && !/\bj/i.test(match[0])) continue;
    const days = Number(String(match[1]).replace(',', '.'));
    const rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`.replace(/\s+/g, ' ').trim();
    return { days: Number.isFinite(days) ? days : null, rest };
  }
  return { days: null, rest: text };
}

function cleanupName(value: string) {
  return value
    .replace(/\b(?:dr|qte|qté|qty)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePrescriptionLine(
  input: {
    rawText?: string;
    medication?: string;
    dosage?: string;
    posology?: string;
    duration?: string;
    quantityPrescribed?: number | null;
    instructions?: string;
  },
  abbreviations: PharmacyAbbreviationDef[] = DEFAULT_PHARMACY_ABBREVIATIONS,
): ParsedPrescriptionLine {
  const abbrevs = mergeAbbreviations(DEFAULT_PHARMACY_ABBREVIATIONS, abbreviations);
  const alerts: ParsedPrescriptionLine['alerts'] = [];

  const composed = input.rawText?.trim()
    || [
      input.medication ? `R/ ${input.medication}` : '',
      (input.dosage || input.posology) ? `S/ ${[input.dosage, input.posology].filter(Boolean).join(' ')}` : '',
      input.duration && input.duration !== 'Selon prescription' ? input.duration : '',
      input.instructions || '',
    ].filter(Boolean).join(' ');

  const rawText = collapseSpaces(composed || '');
  const { rPart, sPart } = splitRS(rawText);

  let workingR = rPart;
  const marked = extractMarkedQuantity(workingR);
  workingR = marked.rest;
  const dosageHit = extractDosageFromText(workingR);
  workingR = dosageHit.rest;
  const formHit = extractFormToken(workingR, abbrevs);
  workingR = formHit.rest;

  let workingS = sPart || '';
  if (input.duration && input.duration !== 'Selon prescription' && !workingS.includes(input.duration)) {
    workingS = `${workingS} ${input.duration}`.trim();
  }

  const doseHit = extractDosePerDay(workingS, abbrevs);
  workingS = doseHit.rest;
  const durationHit = extractDurationDays(workingS);
  workingS = durationHit.rest;

  // Also allow duration embedded in R part rarely
  if (durationHit.days == null) {
    const durationOnR = extractDurationDays(workingR);
    if (durationOnR.days != null) {
      durationHit.days = durationOnR.days;
      workingR = durationOnR.rest;
    }
  }

  const medicationName = cleanupName(workingR);
  const quantityFromPosology =
    doseHit.dosePerDay != null && durationHit.days != null
      ? doseHit.dosePerDay * durationHit.days
      : null;

  let quantityMarked = marked.quantity;
  if (quantityMarked == null && input.quantityPrescribed != null && input.quantityPrescribed > 0) {
    // Only trust explicit quantityPrescribed if it looks intentional (>1) OR no posology qty exists
    if (input.quantityPrescribed > 1 || quantityFromPosology == null) {
      quantityMarked = input.quantityPrescribed;
    }
  }

  let quantityProposed: number | null = null;
  if (quantityMarked != null && quantityFromPosology != null && quantityMarked !== quantityFromPosology) {
    alerts.push({
      code: 'quantity_ambiguous',
      message: `Anomalie : la quantité marquée (DR ${quantityMarked}) ne correspond pas à la posologie × durée (${quantityFromPosology}). Quantité proposée : ${quantityFromPosology}. Confirmation pharmacien requise.`,
    });
    // On retient la quantité calculée (posologie × durée), jamais un choix silencieux du DR.
    quantityProposed = quantityFromPosology;
  } else if (quantityMarked != null) {
    quantityProposed = quantityMarked;
  } else if (quantityFromPosology != null) {
    quantityProposed = quantityFromPosology;
  } else {
    alerts.push({
      code: 'quantity_unknown',
      message: 'Impossible de déterminer la quantité à délivrer sans inventer une valeur.',
    });
  }

  if (!medicationName) {
    alerts.push({ code: 'needs_review', message: 'Nom du médicament non identifié.' });
  }
  if (!formHit.form) {
    alerts.push({ code: 'needs_review', message: 'Forme pharmaceutique non reconnue.' });
  }

  const needsPharmacistValidation = alerts.some((alert) =>
    alert.code === 'quantity_ambiguous'
    || alert.code === 'quantity_unknown'
    || alert.code === 'needs_review');

  let confidence: ParsedPrescriptionLine['confidence'] = 'high';
  if (needsPharmacistValidation) confidence = 'low';
  else if (!dosageHit.dosage?.amount || !formHit.form) confidence = 'medium';

  const instructions = [
    workingS,
    input.instructions && input.instructions !== 'Selon prescription' ? input.instructions : '',
  ].filter(Boolean).join(' · ').trim();

  return {
    rawText,
    medicationName,
    dosage: dosageHit.dosage || { amount: null, unit: '', raw: '' },
    form: formHit.form,
    formUnit: formHit.formUnit,
    quantityMarked,
    dosePerDay: doseHit.dosePerDay,
    durationDays: durationHit.days,
    quantityFromPosology,
    quantityProposed,
    posologyText: sPart || [input.dosage, input.posology].filter(Boolean).join(' '),
    instructions,
    alerts,
    confidence,
    needsPharmacistValidation,
  };
}

export function parseDosageLabel(value?: string | null): ParsedDosage | null {
  if (!value) return null;
  const hit = extractDosageFromText(normalizeText(value));
  return hit.dosage;
}

function dosagesCompatible(prescribed: ParsedDosage, catalogLabel?: string | null) {
  if (!prescribed.amount) return { ok: false, reason: 'missing_prescribed' as const };
  const catalog = parseDosageLabel(catalogLabel || '');
  if (!catalog?.amount) return { ok: false, reason: 'missing_catalog' as const };
  if (catalog.amount !== prescribed.amount) return { ok: false, reason: 'amount' as const };
  if (prescribed.unit && catalog.unit && prescribed.unit !== catalog.unit) return { ok: false, reason: 'unit' as const };
  return { ok: true, reason: 'ok' as const };
}

function nameTokens(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

export function matchCatalogProduct(
  parsed: ParsedPrescriptionLine,
  products: CatalogProductLike[],
  abbreviations: PharmacyAbbreviationDef[] = DEFAULT_PHARMACY_ABBREVIATIONS,
): CatalogMatch {
  const abbrevs = mergeAbbreviations(DEFAULT_PHARMACY_ABBREVIATIONS, abbreviations);
  const alerts: CatalogMatch['alerts'] = [];
  const active = products.filter((product) => product.active !== false && !product.archivedAt);
  const needle = nameTokens(parsed.medicationName);

  const scored = active.map((product) => {
    const hay = new Set([...nameTokens(product.name), ...nameTokens(product.genericName || '')]);
    const overlap = needle.filter((token) => hay.has(token)).length;
    const exactName = normalizeText(product.name).toLowerCase() === normalizeText(parsed.medicationName).toLowerCase();
    const dosage = dosagesCompatible(parsed.dosage, product.dosage);
    const formOk = parsed.form
      ? formsCompatible(parsed.form, product.form || '', abbrevs)
        || formsCompatible(parsed.formUnit, product.form || '', abbrevs)
        || formsCompatible(parsed.formUnit, product.unit || '', abbrevs)
        || formsCompatible(parsed.formUnit, product.saleUnit || '', abbrevs)
      : false;

    let score = overlap * 10;
    if (exactName) score += 50;
    if (dosage.ok) score += 40;
    if (formOk) score += 30;
    if (overlap === 0 && !exactName) score = 0;

    return { product, score, dosage, formOk, overlap, exactName };
  }).filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const strict = scored.filter((row) => {
    if (parsed.dosage.amount != null && !row.dosage.ok) return false;
    if (parsed.form && !row.formOk) return false;
    return row.overlap > 0 || row.exactName;
  });

  if (!strict.length) {
    const near = scored[0];
    if (near && parsed.dosage.amount != null && !near.dosage.ok) {
      alerts.push({ code: 'dosage_mismatch', message: 'Aucun produit au même dosage.' });
    }
    if (near && parsed.form && !near.formOk) {
      alerts.push({ code: 'form_mismatch', message: 'Aucun produit à la même forme pharmaceutique.' });
    }
    alerts.push({ code: 'product_not_found', message: 'Aucune correspondance catalogue stricte.' });
    return {
      productId: null,
      productName: '',
      confidence: 'none',
      alerts,
      candidates: scored.slice(0, 3).map((row) => ({ id: row.product.id, name: row.product.name })),
    };
  }

  if (strict.length > 1 && strict[0].score === strict[1].score) {
    alerts.push({ code: 'multiple_matches', message: 'Plusieurs produits compatibles — validation pharmacien.' });
    return {
      productId: null,
      productName: '',
      confidence: 'low',
      alerts,
      candidates: strict.slice(0, 5).map((row) => ({ id: row.product.id, name: row.product.name })),
    };
  }

  const best = strict[0];
  return {
    productId: best.product.id,
    productName: best.product.name,
    confidence: best.exactName && best.dosage.ok && best.formOk ? 'high' : 'medium',
    alerts,
    candidates: strict.slice(0, 5).map((row) => ({ id: row.product.id, name: row.product.name })),
  };
}

export function buildLineQuote(
  parsed: ParsedPrescriptionLine,
  match: CatalogMatch,
  product?: CatalogProductLike | null,
): LineQuote {
  const alerts = [...parsed.alerts, ...match.alerts];
  if (!product || !match.productId) {
    return {
      unitPrice: null,
      quantityProposed: parsed.quantityProposed,
      quantityValidated: null,
      lineTotal: null,
      billable: false,
      alerts: alerts.some((alert) => alert.code === 'product_not_found')
        ? alerts
        : [...alerts, { code: 'product_not_found', message: 'Produit non associé — non facturable.' }],
    };
  }

  if (!(product.price > 0)) {
    alerts.push({ code: 'price_missing', message: 'Prix de vente non configuré.' });
  }

  const quantityProposed = parsed.quantityProposed;
  const billable = quantityProposed != null
    && quantityProposed > 0
    && product.price > 0
    && !parsed.needsPharmacistValidation
    && match.confidence !== 'none'
    && match.confidence !== 'low';

  return {
    unitPrice: product.price > 0 ? product.price : null,
    quantityProposed,
    quantityValidated: null,
    // Total affiché même en revue ; billable=false tant que le pharmacien n’a pas confirmé l’anomalie.
    lineTotal: quantityProposed != null && product.price > 0
      ? Number((product.price * quantityProposed).toFixed(2))
      : null,
    billable,
    alerts,
  };
}

export function summarizeQuote(lines: Array<{ lineTotal: number | null; billable: boolean }>) {
  const withTotal = lines.filter((line) => line.lineTotal != null);
  const billableLines = lines.filter((line) => line.billable && line.lineTotal != null);
  const pendingCount = lines.filter((line) => !line.billable).length;
  // Total estimé = toutes les lignes chiffrées (y compris anomalies à confirmer).
  const total = withTotal.reduce((sum, line) => sum + (line.lineTotal || 0), 0);
  const validatedTotal = billableLines.reduce((sum, line) => sum + (line.lineTotal || 0), 0);
  return {
    total: Number(total.toFixed(2)),
    validatedTotal: Number(validatedTotal.toFixed(2)),
    billableCount: billableLines.length,
    pendingCount,
  };
}
