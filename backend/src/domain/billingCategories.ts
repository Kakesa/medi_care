export const BILLING_CURRENCIES = ['EUR', 'CDF', 'USD'] as const;
export type BillingCurrency = (typeof BILLING_CURRENCIES)[number];

export const BILLING_UNITS = ['acte', 'unite', 'boite', 'jour', 'nuit', 'heure', 'seance', 'autre'] as const;
export type BillingUnit = (typeof BILLING_UNITS)[number];

export const BILLING_CATEGORIES = [
  { code: 'CONSULTATION', label: 'Consultation' },
  { code: 'URGENCE', label: 'Urgence' },
  { code: 'HOSPITALISATION', label: 'Hospitalisation' },
  { code: 'OCCUPATION_LIT', label: 'Occupation de lit' },
  { code: 'SOINS_INFIRMIERS', label: 'Soins infirmiers' },
  { code: 'ACTE_MEDICAL', label: 'Acte médical' },
  { code: 'LABORATOIRE', label: 'Laboratoire' },
  { code: 'IMAGERIE', label: 'Imagerie' },
  { code: 'MEDICAMENT', label: 'Médicament' },
  { code: 'CONSOMMABLE', label: 'Consommable' },
  { code: 'CHIRURGIE', label: 'Chirurgie' },
  { code: 'ANESTHESIE', label: 'Anesthésie' },
  { code: 'REANIMATION', label: 'Réanimation' },
  { code: 'AMBULANCE', label: 'Ambulance' },
  { code: 'REEDUCATION', label: 'Rééducation' },
  { code: 'FRAIS_ADMINISTRATIFS', label: 'Frais administratifs' },
  { code: 'AUTRE', label: 'Autre' },
] as const;

const LEGACY_TYPES: Record<string, string> = {
  consultation: 'CONSULTATION',
  exam: 'LABORATOIRE',
  medication: 'MEDICAMENT',
  service: 'AUTRE',
};

export function resolveCategory(item: { category?: string | null; type?: string | null }) {
  if (item.category) return item.category;
  if (item.type && LEGACY_TYPES[item.type]) return LEGACY_TYPES[item.type];
  return item.type || 'AUTRE';
}

export function isBillingCurrency(value: string): value is BillingCurrency {
  return (BILLING_CURRENCIES as readonly string[]).includes(value);
}
