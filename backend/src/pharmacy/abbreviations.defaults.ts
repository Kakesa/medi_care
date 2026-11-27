export type AbbreviationKind = 'form' | 'unit' | 'frequency' | 'duration' | 'marker' | 'other';

export type PharmacyAbbreviationDef = {
  code: string;
  meaning: string;
  kind: AbbreviationKind;
  unit?: string;
  variants: string[];
  active: boolean;
};

/** Dictionnaire de base — surchargeable par établissement. */
export const DEFAULT_PHARMACY_ABBREVIATIONS: PharmacyAbbreviationDef[] = [
  { code: 'ces', meaning: 'Comprimés', kind: 'form', unit: 'comprimé', variants: ['cés', 'ces', 'cps', 'comp', 'comprimes', 'comprimés'], active: true },
  { code: 'ce', meaning: 'Comprimé', kind: 'form', unit: 'comprimé', variants: ['cé', 'ce', 'cp', 'comp'], active: true },
  { code: 'amps', meaning: 'Ampoules', kind: 'form', unit: 'ampoule', variants: ['amps', 'ampoules'], active: true },
  { code: 'amp', meaning: 'Ampoule', kind: 'form', unit: 'ampoule', variants: ['amp', 'ampoule'], active: true },
  { code: 'fl', meaning: 'Flacon', kind: 'form', unit: 'flacon', variants: ['fl', 'flacon', 'flacons'], active: true },
  { code: 'inj', meaning: 'Injectable', kind: 'form', unit: 'injection', variants: ['inj', 'injectable', 'injectables'], active: true },
  { code: 'gel', meaning: 'Gel', kind: 'form', unit: 'gel', variants: ['gel', 'gels'], active: true },
  { code: 'cr', meaning: 'Crème', kind: 'form', unit: 'crème', variants: ['cr', 'creme', 'crème', 'cremes'], active: true },
  { code: 'pomm', meaning: 'Pommade', kind: 'form', unit: 'pommade', variants: ['pomm', 'pommade', 'pommades'], active: true },
  { code: 'gtt', meaning: 'Gouttes', kind: 'form', unit: 'goutte', variants: ['gtt', 'gte', 'gouttes'], active: true },
  { code: 'sach', meaning: 'Sachet', kind: 'form', unit: 'sachet', variants: ['sach', 'sachet', 'sachets'], active: true },
  { code: 'suppo', meaning: 'Suppositoire', kind: 'form', unit: 'suppositoire', variants: ['suppo', 'supp', 'suppositoire'], active: true },
  { code: 'per_j', meaning: 'Par jour', kind: 'frequency', variants: ['/j', 'par j', 'par jour', 'pj', 'die'], active: true },
  { code: 'h', meaning: 'Heure', kind: 'duration', variants: ['h', 'hr', 'heure', 'heures'], active: true },
  { code: 'j', meaning: 'Jour', kind: 'duration', variants: ['j', 'jr', 'jour', 'jours', 'd'], active: true },
  { code: 'dr', meaning: 'Quantité à délivrer', kind: 'marker', variants: ['dr', 'qte', 'qté', 'qty'], active: true },
  { code: 's', meaning: 'Signatura / posologie', kind: 'marker', variants: ['s/', 's'], active: true },
];

export function normalizeAbbrevToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, '')
    .trim();
}

export function mergeAbbreviations(
  defaults: PharmacyAbbreviationDef[],
  overrides: PharmacyAbbreviationDef[] = [],
): PharmacyAbbreviationDef[] {
  const byCode = new Map<string, PharmacyAbbreviationDef>();
  for (const item of defaults) byCode.set(item.code, { ...item, variants: [...item.variants] });
  for (const item of overrides) {
    const current = byCode.get(item.code);
    byCode.set(item.code, current
      ? {
          ...current,
          ...item,
          variants: Array.from(new Set([...(item.variants || []), ...current.variants])),
        }
      : { ...item, variants: [...item.variants] });
  }
  return Array.from(byCode.values()).filter((item) => item.active !== false);
}

/** Variantes triées du plus long au plus court pour éviter les collisions (Cés avant Cé). */
export function abbreviationLookup(abbreviations: PharmacyAbbreviationDef[]) {
  const entries: Array<{ token: string; def: PharmacyAbbreviationDef }> = [];
  for (const def of abbreviations) {
    if (!def.active) continue;
    const tokens = new Set([normalizeAbbrevToken(def.code), ...def.variants.map(normalizeAbbrevToken)]);
    for (const token of tokens) {
      if (token) entries.push({ token, def });
    }
  }
  entries.sort((a, b) => b.token.length - a.token.length || a.token.localeCompare(b.token));
  return entries;
}

export function resolveFormUnit(token: string, abbreviations: PharmacyAbbreviationDef[]) {
  const needle = normalizeAbbrevToken(token);
  if (!needle) return null;
  const hit = abbreviationLookup(abbreviations).find((entry) => entry.token === needle && entry.def.kind === 'form');
  if (!hit) return null;
  return { meaning: hit.def.meaning, unit: hit.def.unit || hit.def.meaning, code: hit.def.code };
}

export function formSynonyms(abbreviations: PharmacyAbbreviationDef[]) {
  const groups = new Map<string, Set<string>>();
  for (const def of abbreviations.filter((item) => item.kind === 'form' && item.active)) {
    const key = normalizeAbbrevToken(def.unit || def.meaning);
    const bucket = groups.get(key) || new Set<string>();
    bucket.add(key);
    bucket.add(normalizeAbbrevToken(def.meaning));
    bucket.add(normalizeAbbrevToken(def.code));
    for (const variant of def.variants) bucket.add(normalizeAbbrevToken(variant));
    groups.set(key, bucket);
  }
  return groups;
}

export function formsCompatible(a: string, b: string, abbreviations: PharmacyAbbreviationDef[]) {
  const left = normalizeAbbrevToken(a);
  const right = normalizeAbbrevToken(b);
  if (!left || !right) return false;
  if (left === right) return true;
  for (const group of formSynonyms(abbreviations).values()) {
    if (group.has(left) && group.has(right)) return true;
  }
  return false;
}
