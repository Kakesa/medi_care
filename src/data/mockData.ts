// Mock data for the SIH application

export interface User {
  id: string;
  email: string;
  password: string;
  role: 'admin' | 'doctor' | 'patient' | 'receptionist';
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
}

export interface Personnel {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'doctor' | 'nurse' | 'secretary' | 'admin' | 'receptionist';
  department: string;
  speciality?: string;
  status: 'active' | 'pending' | 'inactive';
  hireDate: string;
  avatar?: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'M' | 'F';
  address: string;
  bloodType?: string;
  allergies?: string[];
  status: 'hospitalized' | 'outpatient' | 'discharged';
  room?: string;
  admissionDate?: string;
  dischargeDate?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'followup' | 'exam' | 'emergency';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: string;
}

export interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  appointmentId?: string;
  date: string;
  diagnosis: string;
  symptoms: string[];
  treatment: string;
  prescription?: string;
  notes?: string;
  followUpDate?: string;
  status: 'in_progress' | 'completed';
}

export interface Reception {
  id: string;
  patientId: string;
  patientName: string;
  arrivalTime: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'waiting' | 'in_consultation' | 'completed' | 'cancelled';
  assignedDoctor?: string;
  notes?: string;
  createdAt: string;
}

export interface Exam {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  type: 'laboratory' | 'imaging' | 'biopsy' | 'other';
  category: string;
  name: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  results?: string;
  files?: string[];
  notes?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'appointment' | 'patient_arrival' | 'exam_result' | 'pharmacy' | 'general';
  title: string;
  message: string;
  read: boolean;
  userId?: string;
  relatedId?: string;
  createdAt: string;
}

export interface PharmacyProduct {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  unit: string;
  price: number;
  supplier: string;
  expiryDate?: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  lastRestocked?: string;
}

export interface PharmacyOrder {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  supplier: string;
  orderDate: string;
  expectedDelivery?: string;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  totalCost: number;
  notes?: string;
}

// Mock Users
export const mockUsers: User[] = [
  {
    id: "user-1",
    email: "admin@medicare.fr",
    password: "admin123",
    role: "admin",
    firstName: "Jean",
    lastName: "Administrateur",
    phone: "06 00 00 00 01"
  },
  {
    id: "user-2",
    email: "dr.bernard@medicare.fr",
    password: "doctor123",
    role: "doctor",
    firstName: "Sophie",
    lastName: "Bernard",
    phone: "06 12 34 56 78"
  },
  {
    id: "user-3",
    email: "patient@email.fr",
    password: "patient123",
    role: "patient",
    firstName: "Marie",
    lastName: "Dupont",
    phone: "06 23 45 67 89"
  },
  {
    id: "user-4",
    email: "reception@medicare.fr",
    password: "reception123",
    role: "receptionist",
    firstName: "Claire",
    lastName: "Martin",
    phone: "06 34 56 78 90"
  }
];

// Mock Personnel
export const mockPersonnel: Personnel[] = [
  {
    id: "pers-1",
    userId: "user-2",
    firstName: "Sophie",
    lastName: "Bernard",
    email: "dr.bernard@medicare.fr",
    phone: "06 12 34 56 78",
    role: "doctor",
    department: "Cardiologie",
    speciality: "Cardiologue",
    status: "active",
    hireDate: "2020-01-15",
    avatar: "SB"
  },
  {
    id: "pers-2",
    firstName: "Pierre",
    lastName: "Leroy",
    email: "dr.leroy@medicare.fr",
    phone: "06 23 45 67 89",
    role: "doctor",
    department: "Neurologie",
    speciality: "Neurologue",
    status: "active",
    hireDate: "2019-06-20",
    avatar: "PL"
  },
  {
    id: "pers-3",
    firstName: "Marie",
    lastName: "Dupont",
    email: "m.dupont@medicare.fr",
    phone: "06 34 56 78 90",
    role: "nurse",
    department: "Urgences",
    status: "pending",
    hireDate: "2024-01-01",
    avatar: "MD"
  },
  {
    id: "pers-4",
    firstName: "Marc",
    lastName: "Duval",
    email: "dr.duval@medicare.fr",
    phone: "06 45 67 89 01",
    role: "doctor",
    department: "Pédiatrie",
    speciality: "Pédiatre",
    status: "active",
    hireDate: "2018-09-10",
    avatar: "MD"
  },
  {
    id: "pers-5",
    firstName: "Claire",
    lastName: "Martin",
    email: "c.martin@medicare.fr",
    phone: "06 56 78 90 12",
    role: "secretary",
    department: "Administration",
    status: "active",
    hireDate: "2021-03-15",
    avatar: "CM"
  },
  {
    id: "pers-6",
    firstName: "Lucie",
    lastName: "Petit",
    email: "l.petit@medicare.fr",
    phone: "06 67 89 01 23",
    role: "receptionist",
    department: "Accueil",
    status: "active",
    hireDate: "2022-07-01",
    avatar: "LP"
  }
];

// Mock Patients
export const mockPatients: Patient[] = [
  {
    id: "pat-1",
    firstName: "Jean",
    lastName: "Martin",
    email: "jean.martin@email.fr",
    phone: "06 12 34 56 78",
    dateOfBirth: "1979-05-15",
    gender: "M",
    address: "12 Rue de Paris, 75001 Paris",
    bloodType: "A+",
    allergies: ["Pénicilline"],
    status: "hospitalized",
    room: "A-102",
    admissionDate: "2024-01-10",
    createdAt: "2023-06-15"
  },
  {
    id: "pat-2",
    firstName: "Marie",
    lastName: "Dupont",
    email: "marie.dupont@email.fr",
    phone: "06 23 45 67 89",
    dateOfBirth: "1992-08-22",
    gender: "F",
    address: "8 Avenue Victor Hugo, 75016 Paris",
    bloodType: "O-",
    status: "outpatient",
    createdAt: "2023-09-20"
  },
  {
    id: "pat-3",
    firstName: "Pierre",
    lastName: "Durand",
    email: "pierre.durand@email.fr",
    phone: "06 34 56 78 90",
    dateOfBirth: "1957-12-03",
    gender: "M",
    address: "45 Boulevard Haussmann, 75008 Paris",
    bloodType: "B+",
    allergies: ["Aspirine", "Ibuprofène"],
    status: "hospitalized",
    room: "B-215",
    admissionDate: "2024-01-05",
    createdAt: "2022-11-10"
  },
  {
    id: "pat-4",
    firstName: "Sophie",
    lastName: "Lambert",
    email: "sophie.lambert@email.fr",
    phone: "06 45 67 89 01",
    dateOfBirth: "1996-02-14",
    gender: "F",
    address: "23 Rue de Rivoli, 75004 Paris",
    bloodType: "AB+",
    status: "outpatient",
    createdAt: "2024-01-02"
  },
  {
    id: "pat-5",
    firstName: "Michel",
    lastName: "Bernard",
    email: "michel.bernard@email.fr",
    phone: "06 56 78 90 12",
    dateOfBirth: "1969-07-28",
    gender: "M",
    address: "67 Rue du Faubourg, 75010 Paris",
    bloodType: "A-",
    status: "discharged",
    dischargeDate: "2024-01-18",
    createdAt: "2023-08-05"
  }
];

// Mock Appointments
export const mockAppointments: Appointment[] = [
  {
    id: "apt-1",
    patientId: "pat-1",
    patientName: "Jean Martin",
    doctorId: "pers-1",
    doctorName: "Dr. Sophie Bernard",
    date: "2024-01-22",
    time: "09:00",
    duration: 30,
    type: "consultation",
    status: "confirmed",
    createdAt: "2024-01-15"
  },
  {
    id: "apt-2",
    patientId: "pat-2",
    patientName: "Marie Dupont",
    doctorId: "pers-1",
    doctorName: "Dr. Sophie Bernard",
    date: "2024-01-22",
    time: "09:30",
    duration: 30,
    type: "followup",
    status: "confirmed",
    createdAt: "2024-01-16"
  },
  {
    id: "apt-3",
    patientId: "pat-3",
    patientName: "Pierre Durand",
    doctorId: "pers-2",
    doctorName: "Dr. Pierre Leroy",
    date: "2024-01-22",
    time: "10:30",
    duration: 60,
    type: "exam",
    status: "pending",
    createdAt: "2024-01-17"
  },
  {
    id: "apt-4",
    patientId: "pat-4",
    patientName: "Sophie Lambert",
    doctorId: "pers-1",
    doctorName: "Dr. Sophie Bernard",
    date: "2024-01-22",
    time: "14:00",
    duration: 30,
    type: "consultation",
    status: "confirmed",
    createdAt: "2024-01-18"
  },
  {
    id: "apt-5",
    patientId: "pat-5",
    patientName: "Michel Bernard",
    doctorId: "pers-4",
    doctorName: "Dr. Marc Duval",
    date: "2024-01-22",
    time: "15:00",
    duration: 30,
    type: "followup",
    status: "cancelled",
    createdAt: "2024-01-19"
  },
  {
    id: "apt-6",
    patientId: "pat-2",
    patientName: "Marie Dupont",
    doctorId: "pers-2",
    doctorName: "Dr. Pierre Leroy",
    date: "2024-01-22",
    time: "16:00",
    duration: 45,
    type: "consultation",
    status: "pending",
    createdAt: "2024-01-20"
  }
];

// Mock Consultations
export const mockConsultations: Consultation[] = [
  {
    id: "cons-1",
    patientId: "pat-1",
    patientName: "Jean Martin",
    doctorId: "pers-1",
    doctorName: "Dr. Sophie Bernard",
    date: "2024-01-15",
    diagnosis: "Hypertension artérielle",
    symptoms: ["Maux de tête", "Fatigue", "Vertiges"],
    treatment: "Régime alimentaire + Amlodipine 5mg",
    prescription: "Amlodipine 5mg - 1 comprimé par jour pendant 3 mois",
    followUpDate: "2024-02-15",
    status: "completed"
  },
  {
    id: "cons-2",
    patientId: "pat-2",
    patientName: "Marie Dupont",
    doctorId: "pers-1",
    doctorName: "Dr. Sophie Bernard",
    date: "2024-01-18",
    diagnosis: "Bronchite aiguë",
    symptoms: ["Toux", "Fièvre légère", "Fatigue"],
    treatment: "Repos + Antibiotiques",
    prescription: "Amoxicilline 500mg - 3 fois par jour pendant 7 jours",
    status: "completed"
  },
  {
    id: "cons-3",
    patientId: "pat-3",
    patientName: "Pierre Durand",
    doctorId: "pers-2",
    doctorName: "Dr. Pierre Leroy",
    date: "2024-01-20",
    diagnosis: "En cours d'évaluation",
    symptoms: ["Céphalées persistantes", "Troubles visuels"],
    treatment: "IRM cérébrale recommandée",
    notes: "Patient à surveiller, résultats IRM attendus",
    status: "in_progress"
  }
];

// Mock Reception entries
export const mockReception: Reception[] = [
  {
    id: "rec-1",
    patientId: "pat-4",
    patientName: "Sophie Lambert",
    arrivalTime: "08:30",
    reason: "Consultation de routine",
    priority: "low",
    status: "waiting",
    createdAt: "2024-01-22"
  },
  {
    id: "rec-2",
    patientId: "pat-1",
    patientName: "Jean Martin",
    arrivalTime: "08:45",
    reason: "Suivi cardiaque",
    priority: "medium",
    status: "in_consultation",
    assignedDoctor: "Dr. Sophie Bernard",
    createdAt: "2024-01-22"
  },
  {
    id: "rec-3",
    patientId: "",
    patientName: "Nouveau patient",
    arrivalTime: "09:00",
    reason: "Douleur thoracique",
    priority: "urgent",
    status: "waiting",
    notes: "Patient non enregistré, à créer dans le système",
    createdAt: "2024-01-22"
  },
  {
    id: "rec-4",
    patientId: "pat-2",
    patientName: "Marie Dupont",
    arrivalTime: "09:15",
    reason: "Retrait résultats",
    priority: "low",
    status: "completed",
    createdAt: "2024-01-22"
  }
];

// Mock Exams
export const mockExams: Exam[] = [
  {
    id: "exam-1",
    patientId: "pat-1",
    patientName: "Jean Martin",
    doctorId: "pers-1",
    doctorName: "Dr. Sophie Bernard",
    type: "laboratory",
    category: "Hématologie",
    name: "Bilan sanguin complet",
    date: "2024-01-20",
    status: "completed",
    results: "Globules rouges: 4.5M/µL, Globules blancs: 7500/µL, Plaquettes: 250000/µL, Hémoglobine: 14g/dL",
    createdAt: "2024-01-18"
  },
  {
    id: "exam-2",
    patientId: "pat-3",
    patientName: "Pierre Durand",
    doctorId: "pers-2",
    doctorName: "Dr. Pierre Leroy",
    type: "imaging",
    category: "Imagerie cérébrale",
    name: "IRM cérébrale",
    date: "2024-01-22",
    status: "pending",
    createdAt: "2024-01-20"
  },
  {
    id: "exam-3",
    patientId: "pat-2",
    patientName: "Marie Dupont",
    doctorId: "pers-1",
    doctorName: "Dr. Sophie Bernard",
    type: "laboratory",
    category: "Biochimie",
    name: "Glycémie à jeun",
    date: "2024-01-19",
    status: "completed",
    results: "Glycémie: 0.95 g/L (Normal: 0.70-1.10 g/L)",
    createdAt: "2024-01-17"
  },
  {
    id: "exam-4",
    patientId: "pat-4",
    patientName: "Sophie Lambert",
    doctorId: "pers-4",
    doctorName: "Dr. Marc Duval",
    type: "imaging",
    category: "Radiologie",
    name: "Radio thoracique",
    date: "2024-01-21",
    status: "in_progress",
    createdAt: "2024-01-19"
  }
];

// Mock Notifications
export const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    type: "appointment",
    title: "Nouveau rendez-vous",
    message: "Marie Dupont a demandé un RDV pour le 25/01/2024",
    read: false,
    createdAt: "2024-01-22T09:00:00"
  },
  {
    id: "notif-2",
    type: "patient_arrival",
    title: "Arrivée patient",
    message: "Jean Martin est arrivé pour sa consultation",
    read: false,
    createdAt: "2024-01-22T08:45:00"
  },
  {
    id: "notif-3",
    type: "exam_result",
    title: "Résultats disponibles",
    message: "Résultats du bilan sanguin de Jean Martin disponibles",
    read: true,
    createdAt: "2024-01-21T15:30:00"
  },
  {
    id: "notif-4",
    type: "pharmacy",
    title: "Stock faible",
    message: "Amoxicilline 500mg: stock critique (15 unités)",
    read: false,
    createdAt: "2024-01-22T07:00:00"
  }
];

// Mock Pharmacy Products
export const mockPharmacyProducts: PharmacyProduct[] = [
  {
    id: "prod-1",
    name: "Amoxicilline 500mg",
    category: "Antibiotiques",
    quantity: 15,
    minStock: 50,
    unit: "comprimés",
    price: 0.35,
    supplier: "Pharma Plus",
    expiryDate: "2025-06-15",
    status: "low_stock",
    lastRestocked: "2024-01-10"
  },
  {
    id: "prod-2",
    name: "Paracétamol 1000mg",
    category: "Antalgiques",
    quantity: 500,
    minStock: 100,
    unit: "comprimés",
    price: 0.15,
    supplier: "MediStock",
    expiryDate: "2025-12-01",
    status: "in_stock",
    lastRestocked: "2024-01-15"
  },
  {
    id: "prod-3",
    name: "Insuline Lantus",
    category: "Antidiabétiques",
    quantity: 25,
    minStock: 30,
    unit: "stylos",
    price: 45.00,
    supplier: "Sanofi",
    expiryDate: "2024-08-20",
    status: "low_stock",
    lastRestocked: "2024-01-05"
  },
  {
    id: "prod-4",
    name: "Sérum physiologique 500ml",
    category: "Solutions",
    quantity: 200,
    minStock: 50,
    unit: "flacons",
    price: 2.50,
    supplier: "MediStock",
    expiryDate: "2026-03-15",
    status: "in_stock",
    lastRestocked: "2024-01-18"
  },
  {
    id: "prod-5",
    name: "Amlodipine 5mg",
    category: "Antihypertenseurs",
    quantity: 0,
    minStock: 40,
    unit: "comprimés",
    price: 0.28,
    supplier: "Pharma Plus",
    expiryDate: "2025-09-10",
    status: "out_of_stock",
    lastRestocked: "2023-12-20"
  }
];

// Mock Pharmacy Orders
export const mockPharmacyOrders: PharmacyOrder[] = [
  {
    id: "order-1",
    productId: "prod-1",
    productName: "Amoxicilline 500mg",
    quantity: 200,
    supplier: "Pharma Plus",
    orderDate: "2024-01-20",
    expectedDelivery: "2024-01-25",
    status: "confirmed",
    totalCost: 70.00
  },
  {
    id: "order-2",
    productId: "prod-5",
    productName: "Amlodipine 5mg",
    quantity: 150,
    supplier: "Pharma Plus",
    orderDate: "2024-01-22",
    status: "pending",
    totalCost: 42.00
  }
];

// Available doctors for appointments
export const availableDoctors = mockPersonnel.filter(p => p.role === 'doctor' && p.status === 'active');

// Departments
export const departments = [
  "Cardiologie",
  "Neurologie",
  "Pédiatrie",
  "Urgences",
  "Chirurgie",
  "Radiologie",
  "Administration",
  "Accueil",
  "Pharmacie"
];

// Role labels
export const roleLabels = {
  doctor: "Médecin",
  nurse: "Infirmier(ère)",
  secretary: "Secrétaire",
  admin: "Administrateur",
  receptionist: "Réceptionniste"
};

// Exam categories
export const examCategories = {
  laboratory: ["Hématologie", "Biochimie", "Microbiologie", "Immunologie", "Toxicologie"],
  imaging: ["Radiologie", "Scanner", "IRM", "Échographie", "Imagerie cérébrale"],
  biopsy: ["Histologie", "Cytologie"],
  other: ["ECG", "EEG", "EMG", "Test d'effort"]
};

// Pharmacy categories
export const pharmacyCategories = [
  "Antibiotiques",
  "Antalgiques",
  "Anti-inflammatoires",
  "Antidiabétiques",
  "Antihypertenseurs",
  "Anticoagulants",
  "Solutions",
  "Vaccins",
  "Équipements"
];
