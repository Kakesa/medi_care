export interface BillingCategory {
  code: string;
  label: string;
}

export const DEFAULT_CATEGORIES: BillingCategory[] = [
  { code: "CONSULTATION", label: "Consultation" },
  { code: "URGENCE", label: "Urgence" },
  { code: "HOSPITALISATION", label: "Hospitalisation" },
  { code: "OCCUPATION_LIT", label: "Occupation de lit" },
  { code: "SOINS_INFIRMIERS", label: "Soins infirmiers" },
  { code: "ACTE_MEDICAL", label: "Acte médical" },
  { code: "LABORATOIRE", label: "Laboratoire" },
  { code: "IMAGERIE", label: "Imagerie" },
  { code: "MEDICAMENT", label: "Médicament" },
  { code: "CONSOMMABLE", label: "Consommable" },
  { code: "CHIRURGIE", label: "Chirurgie" },
  { code: "ANESTHESIE", label: "Anesthésie" },
  { code: "REANIMATION", label: "Réanimation" },
  { code: "AMBULANCE", label: "Ambulance" },
  { code: "REEDUCATION", label: "Rééducation" },
  { code: "FRAIS_ADMINISTRATIFS", label: "Frais administratifs" },
  { code: "AUTRE", label: "Autre" },
];

export const UNIT_LABELS: Record<string, string> = {
  acte: 'Acte',
  unite: 'Unité',
  boite: 'Boîte',
  jour: 'Jour',
  nuit: 'Nuit',
  heure: 'Heure',
  seance: 'Séance',
  autre: 'Autre',
};

export function categoryLabel(categories: BillingCategory[], code?: string) {
  if (!code) return 'Autre';
  return categories.find((category) => category.code === code)?.label || code;
}
