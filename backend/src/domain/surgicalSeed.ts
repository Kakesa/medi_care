import { LAB_EXAM_SEED } from './labExamSeed.js';

export interface SurgicalSeedAct {
  name: string;
  description: string;
}

export interface SurgicalSeedCategory {
  name: string;
  billingCategory?: string;
  acts: SurgicalSeedAct[];
}

export const SURGICAL_SEED: SurgicalSeedCategory[] = [
  {
    name: 'Chirurgie générale',
    acts: [
      { name: 'Appendicectomie', description: 'Ablation de l’appendice.' },
      { name: 'Herniorraphie', description: 'Cure chirurgicale d’une hernie.' },
      { name: 'Herniorraphie inguinale', description: 'Cure d’une hernie de l’aine.' },
      { name: 'Herniorraphie ombilicale', description: 'Cure d’une hernie au niveau de l’ombilic.' },
      { name: 'Herniorraphie crurale', description: 'Cure d’une hernie crurale.' },
      { name: 'Cholécystectomie', description: 'Ablation de la vésicule biliaire.' },
      { name: 'Kystectomie', description: 'Ablation d’un kyste.' },
      { name: 'Lipomectomie', description: 'Ablation d’un lipome.' },
      { name: 'Laparotomie', description: 'Ouverture chirurgicale de l’abdomen.' },
      { name: 'Splénectomie', description: 'Ablation de la rate.' },
      { name: 'Thyroïdectomie', description: 'Ablation partielle ou totale de la thyroïde.' },
      { name: 'Hémorroïdectomie', description: 'Ablation des hémorroïdes.' },
      { name: 'Fistulectomie', description: 'Exérèse d’une fistule.' },
      { name: 'Fissurectomie', description: 'Exérèse d’une fissure.' },
      { name: 'Mastectomie', description: 'Ablation du sein.' },
    ],
  },
  {
    name: 'Gynécologie et obstétrique',
    acts: [
      { name: 'Césarienne', description: 'Naissance par incision de l’utérus.' },
      { name: 'Hystérectomie', description: 'Ablation de l’utérus.' },
      { name: 'Myomectomie', description: 'Ablation d’un ou plusieurs fibromes.' },
      { name: 'Kystectomie ovarienne', description: 'Ablation d’un kyste de l’ovaire.' },
      { name: 'Salpingectomie', description: 'Ablation d’une trompe.' },
      { name: 'Curetage utérin', description: 'Évacuation du contenu utérin.' },
      { name: 'Conisation du col', description: 'Exérèse d’un fragment du col de l’utérus.' },
    ],
  },
  {
    name: 'Urologie',
    acts: [
      { name: 'Prostatectomie', description: 'Ablation de la prostate.' },
      { name: 'Circoncision', description: 'Ablation du prépuce.' },
      { name: 'Hydrocélectomie', description: 'Cure d’une hydrocèle.' },
      { name: 'Varicocélectomie', description: 'Cure d’une varicocèle.' },
      { name: 'Néphrectomie', description: 'Ablation d’un rein.' },
      { name: 'Cystostomie', description: 'Abouchement de la vessie.' },
    ],
  },
  {
    name: 'Orthopédie et traumatologie',
    acts: [
      { name: 'Ostéosynthèse', description: 'Fixation d’un os fracturé.' },
      { name: 'Réduction de fracture', description: 'Remise en place des fragments osseux.' },
      { name: 'Ablation de matériel d’ostéosynthèse', description: 'Retrait de plaques, vis ou broches.' },
      { name: 'Arthroscopie', description: 'Exploration d’une articulation.' },
      { name: 'Amputation', description: 'Section d’un membre ou d’un segment de membre.' },
      { name: 'Drainage d’abcès', description: 'Évacuation d’une collection purulente.' },
    ],
  },
  {
    name: 'Chirurgie digestive et autres',
    acts: [
      { name: 'Gastrectomie', description: 'Ablation partielle ou totale de l’estomac.' },
      { name: 'Colectomie', description: 'Ablation d’un segment du côlon.' },
      { name: 'Iléostomie', description: 'Abouchement de l’iléon à la peau.' },
      { name: 'Colostomie', description: 'Abouchement du côlon à la peau.' },
      { name: 'Hernie hiatale', description: 'Cure d’une hernie hiatale.' },
      { name: 'Drainage abdominal', description: 'Évacuation d’une collection dans l’abdomen.' },
      { name: 'Parage de plaie', description: 'Nettoyage chirurgical d’une plaie.' },
      { name: 'Suture de plaie', description: 'Fermeture chirurgicale d’une plaie.' },
    ],
  },
  ...LAB_EXAM_SEED,
];

export function surgicalNameKey(value: string) {
  return value.trim().toLocaleLowerCase('fr-FR').replace(/\s+/g, ' ');
}
