# MediCare SIH - Documentation Technique

## 📋 Vue d'ensemble

MediCare SIH est un Système d'Information Hospitalier (SIH) moderne conçu pour centraliser la gestion hospitalière. Cette application permet de gérer le personnel médical, les patients, les rendez-vous, les consultations, les examens, la pharmacie, la facturation et l'accueil des malades.

---

## 🏗️ Structure du Projet

```
medicare-sih/
├── public/                     # Assets statiques
│   ├── favicon.ico
│   ├── robots.txt
│   └── placeholder.svg
│
├── src/
│   ├── components/            # Composants React réutilisables
│   │   ├── dashboard/         # Composants spécifiques au dashboard
│   │   │   ├── RecentActivity.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── UpcomingAppointments.tsx
│   │   │
│   │   ├── forms/             # Formulaires réutilisables
│   │   │   └── AppointmentRequestForm.tsx
│   │   │
│   │   ├── layout/            # Composants de mise en page
│   │   │   ├── DashboardLayout.tsx
│   │   │   └── Sidebar.tsx
│   │   │
│   │   ├── notifications/     # Composants de notifications
│   │   │   └── NotificationDropdown.tsx
│   │   │
│   │   └── ui/                # Composants UI (shadcn/ui)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       └── ... (autres composants UI)
│   │
│   ├── contexts/              # Contextes React
│   │   ├── AuthContext.tsx    # Gestion de l'authentification
│   │   └── NotificationContext.tsx # Gestion des notifications
│   │
│   ├── data/                  # Données mock
│   │   └── mockData.ts        # Données mock pour le développement
│   │
│   ├── hooks/                 # Hooks personnalisés
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   │
│   ├── integrations/          # Intégrations tierces
│   │   └── supabase/          # Client Supabase (pour future BDD)
│   │       ├── client.ts
│   │       └── types.ts
│   │
│   ├── lib/                   # Utilitaires
│   │   └── utils.ts
│   │
│   ├── pages/                 # Pages de l'application
│   │   ├── dashboards/        # Dashboards par rôle
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── DoctorDashboard.tsx
│   │   │   ├── PatientDashboard.tsx
│   │   │   └── ReceptionDashboard.tsx
│   │   │
│   │   ├── Index.tsx          # Page d'accueil (landing page)
│   │   ├── Login.tsx          # Page de connexion
│   │   ├── Register.tsx       # Page d'inscription
│   │   ├── Dashboard.tsx      # Router des dashboards
│   │   ├── Personnel.tsx      # Gestion du personnel
│   │   ├── Patients.tsx       # Gestion des patients
│   │   ├── Appointments.tsx   # Gestion des RDV
│   │   ├── Consultations.tsx  # Gestion des consultations
│   │   ├── Reception.tsx      # Accueil des patients
│   │   ├── Examinations.tsx   # Gestion des examens
│   │   ├── Pharmacy.tsx       # Gestion de la pharmacie
│   │   ├── Billing.tsx        # Gestion de la facturation
│   │   ├── Profile.tsx        # Profil utilisateur
│   │   └── NotFound.tsx       # Page 404
│   │
│   ├── services/              # Services API (architecture modulaire)
│   │   ├── config.ts          # Configuration API
│   │   ├── httpClient.ts      # Client HTTP centralisé
│   │   ├── authService.ts     # Service authentification
│   │   ├── patientService.ts  # Service patients
│   │   ├── personnelService.ts # Service personnel
│   │   ├── appointmentService.ts # Service RDV
│   │   ├── consultationService.ts # Service consultations
│   │   ├── receptionService.ts # Service réception
│   │   ├── examService.ts     # Service examens
│   │   ├── pharmacyService.ts # Service pharmacie
│   │   ├── billingService.ts  # Service facturation
│   │   ├── notificationService.ts # Service notifications
│   │   └── index.ts           # Export unifié
│   │
│   ├── types/                 # Types TypeScript centralisés
│   │   └── index.ts           # Toutes les interfaces et types
│   │
│   ├── utils/                 # Utilitaires
│   │   └── pdfGenerator.ts    # Génération de PDF
│   │
│   ├── App.tsx                # Composant racine avec routing
│   ├── App.css                # Styles globaux
│   ├── index.css              # Variables CSS et design system
│   ├── main.tsx               # Point d'entrée
│   └── vite-env.d.ts          # Types Vite
│
├── supabase/                  # Configuration Supabase
│   └── config.toml
│
├── docs/                      # Documentation
│   └── PROJECT_STRUCTURE.md   # Ce fichier
│
├── .env                       # Variables d'environnement
├── index.html                 # HTML template
├── package.json               # Dépendances NPM
├── tailwind.config.ts         # Configuration Tailwind CSS
├── tsconfig.json              # Configuration TypeScript
└── vite.config.ts             # Configuration Vite
```

---

## 🔐 Authentification

### Comptes de démonstration

| Rôle          | Email                      | Mot de passe   |
|---------------|----------------------------|----------------|
| Admin         | admin@medicare.fr          | admin123       |
| Médecin       | dr.bernard@medicare.fr     | doctor123      |
| Patient       | patient@email.fr           | patient123     |
| Réceptionniste| reception@medicare.fr      | reception123   |

### Système d'authentification

L'authentification est gérée par `AuthContext.tsx` qui fournit :
- `login(email, password)` - Connexion
- `logout()` - Déconnexion
- `register(data)` - Inscription
- `updateProfile(data)` - Mise à jour du profil
- `changePassword(current, new)` - Changement de mot de passe

---

## 📊 Modèles de données (Types)

Tous les types sont centralisés dans `src/types/index.ts` :

### Enums
```typescript
type UserRole = 'admin' | 'doctor' | 'patient' | 'receptionist';
type PersonnelRole = 'doctor' | 'nurse' | 'secretary' | 'admin' | 'receptionist';
type PersonnelStatus = 'active' | 'pending' | 'inactive';
type PatientStatus = 'hospitalized' | 'outpatient' | 'discharged';
type Gender = 'M' | 'F';
type AppointmentType = 'consultation' | 'followup' | 'exam' | 'emergency';
type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
type ConsultationStatus = 'in_progress' | 'completed';
type ReceptionPriority = 'low' | 'medium' | 'high' | 'urgent';
type ReceptionStatus = 'waiting' | 'in_consultation' | 'completed' | 'cancelled';
type ExamType = 'laboratory' | 'imaging' | 'biopsy' | 'other';
type ExamStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type NotificationType = 'appointment' | 'patient_arrival' | 'exam_result' | 'pharmacy' | 'general' | 'billing';
type ProductStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';
type InvoiceStatus = 'pending' | 'paid' | 'cancelled' | 'overdue';
type PaymentMethod = 'cash' | 'card' | 'transfer' | 'insurance';
```

### Interfaces principales

```typescript
interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  address: string;
  bloodType?: string;
  allergies?: string[];
  status: PatientStatus;
  room?: string;
  admissionDate?: string;
  dischargeDate?: string;
  createdAt: string;
}

interface Personnel {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: PersonnelRole;
  department: string;
  speciality?: string;
  status: PersonnelStatus;
  hireDate: string;
  avatar?: string;
}

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  duration: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
}

interface Consultation {
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
  status: ConsultationStatus;
}

interface Exam {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  type: ExamType;
  category: string;
  name: string;
  date: string;
  status: ExamStatus;
  results?: string;
  files?: string[];
  notes?: string;
  createdAt: string;
}

interface PharmacyProduct {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  unit: string;
  price: number;
  supplier: string;
  expiryDate?: string;
  status: ProductStatus;
  lastRestocked?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  patientAddress?: string;
  patientPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  dueDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  userId?: string;
  relatedId?: string;
  createdAt: string;
}
```

---

## 🔧 Architecture des Services API

Les services API sont organisés de manière modulaire dans `src/services/` :

### Configuration (`config.ts`)
```typescript
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  TIMEOUT: 10000,
  HEADERS: {
    'Content-Type': 'application/json',
  },
};
```

### HttpClient (`httpClient.ts`)
Client HTTP centralisé avec gestion automatique des tokens et des erreurs :
- Intercepteur pour ajouter le token d'authentification
- Gestion des erreurs HTTP (401, 403, 404, 500)
- Méthodes : `get`, `post`, `put`, `patch`, `delete`

### Services disponibles

| Fichier | Description | Endpoints |
|---------|-------------|-----------|
| `authService.ts` | Authentification | login, register, logout, me, updateProfile |
| `patientService.ts` | Gestion patients | CRUD, recherche, stats |
| `personnelService.ts` | Gestion personnel | CRUD, par département |
| `appointmentService.ts` | Gestion RDV | CRUD, par date/médecin/patient |
| `consultationService.ts` | Gestion consultations | CRUD, par médecin/patient |
| `receptionService.ts` | Accueil patients | CRUD, file d'attente |
| `examService.ts` | Gestion examens | CRUD, par type/statut |
| `pharmacyService.ts` | Gestion pharmacie | Produits, commandes, stock |
| `billingService.ts` | Facturation | CRUD factures, paiements, stats |
| `notificationService.ts` | Notifications | CRUD, marquer lu, temps réel |

### Utilisation
```typescript
import { 
  patientService, 
  appointmentService,
  billingService 
} from '@/services';

// Récupérer tous les patients
const patients = await patientService.getAll();

// Créer un RDV
const appointment = await appointmentService.create(data);

// Générer une facture
const invoice = await billingService.create(invoiceData);
```

---

## 📄 Génération de PDF

Le module `src/utils/pdfGenerator.ts` permet de générer des documents PDF :

### Fonctions disponibles

| Fonction | Description |
|----------|-------------|
| `generateInvoicePDF(invoice)` | Génère une facture PDF |
| `generatePrescriptionPDF(consultation, patient)` | Génère une ordonnance |
| `generateExamResultPDF(exam)` | Génère un résultat d'examen |
| `generateStatisticsReportPDF(data)` | Génère un rapport statistique |

### Utilisation
```typescript
import { generateInvoicePDF, generatePrescriptionPDF } from '@/utils/pdfGenerator';

// Générer et télécharger une facture
generateInvoicePDF(invoice);

// Générer une ordonnance
generatePrescriptionPDF(consultation, patient);
```

---

## 🎯 Dashboards par rôle

L'application propose des dashboards personnalisés selon le rôle :

### Admin (`AdminDashboard.tsx`)
- Vue globale de toutes les activités
- Graphiques : activité par département, statuts RDV, évolution patients
- Statistiques : personnel, patients, RDV, consultations, pharmacie
- Activité récente et RDV à venir

### Médecin (`DoctorDashboard.tsx`)
- Mes RDV du jour
- Mes consultations récentes
- Mes patients à suivre
- Actions rapides : planifier RDV, nouvelle consultation

### Patient (`PatientDashboard.tsx`)
- Mes prochains RDV
- Mon historique médical
- Mes résultats d'examens
- Mes prescriptions

### Réceptionniste (`ReceptionDashboard.tsx`)
- File d'attente en temps réel
- RDV confirmés du jour
- Actions rapides : planifier RDV, enregistrer arrivée
- Activité du jour

---

## 🔔 Système de notifications

### Types de notifications
- `appointment` - Nouveau RDV ou modification
- `patient_arrival` - Arrivée d'un patient
- `exam_result` - Résultat d'examen disponible
- `pharmacy` - Alerte stock pharmacie
- `billing` - Nouvelle facture ou paiement
- `general` - Notifications générales

### Utilisation
```typescript
import { useNotifications } from '@/contexts/NotificationContext';

const { notifications, addNotification, markAsRead } = useNotifications();

// Ajouter une notification
addNotification({
  type: 'appointment',
  title: 'Nouveau RDV',
  message: 'RDV confirmé pour demain à 10h',
});
```

---

## 📡 Endpoints API Backend

### Authentification
| Méthode | Endpoint             | Description            |
|---------|---------------------|------------------------|
| POST    | /api/auth/login     | Connexion              |
| POST    | /api/auth/register  | Inscription            |
| POST    | /api/auth/logout    | Déconnexion            |
| GET     | /api/auth/me        | Profil courant         |
| PUT     | /api/auth/profile   | Mise à jour profil     |

### Patients
| Méthode | Endpoint                 | Description            |
|---------|--------------------------|------------------------|
| GET     | /api/patients            | Liste des patients     |
| GET     | /api/patients/:id        | Détails d'un patient   |
| POST    | /api/patients            | Créer un patient       |
| PUT     | /api/patients/:id        | Modifier un patient    |
| DELETE  | /api/patients/:id        | Supprimer un patient   |
| GET     | /api/patients/stats      | Statistiques           |

### Personnel
| Méthode | Endpoint                    | Description            |
|---------|-----------------------------|------------------------|
| GET     | /api/personnel              | Liste du personnel     |
| GET     | /api/personnel/:id          | Détails                |
| POST    | /api/personnel              | Ajouter                |
| PUT     | /api/personnel/:id          | Modifier               |
| DELETE  | /api/personnel/:id          | Supprimer              |
| PATCH   | /api/personnel/:id/status   | Changer le statut      |

### Rendez-vous
| Méthode | Endpoint                       | Description            |
|---------|--------------------------------|------------------------|
| GET     | /api/appointments              | Liste des RDV          |
| GET     | /api/appointments/:id          | Détails                |
| POST    | /api/appointments              | Créer un RDV           |
| PUT     | /api/appointments/:id          | Modifier               |
| PATCH   | /api/appointments/:id/status   | Changer le statut      |
| DELETE  | /api/appointments/:id          | Annuler                |

### Consultations
| Méthode | Endpoint                        | Description            |
|---------|---------------------------------|------------------------|
| GET     | /api/consultations              | Liste                  |
| GET     | /api/consultations/:id          | Détails                |
| POST    | /api/consultations              | Créer                  |
| PUT     | /api/consultations/:id          | Modifier               |
| PATCH   | /api/consultations/:id/status   | Terminer               |

### Examens
| Méthode | Endpoint                   | Description            |
|---------|----------------------------|------------------------|
| GET     | /api/exams                 | Liste des examens      |
| GET     | /api/exams/:id             | Détails                |
| POST    | /api/exams                 | Créer                  |
| PUT     | /api/exams/:id             | Modifier               |
| PATCH   | /api/exams/:id/results     | Ajouter résultats      |
| DELETE  | /api/exams/:id             | Supprimer              |

### Pharmacie
| Méthode | Endpoint                      | Description            |
|---------|-------------------------------|------------------------|
| GET     | /api/pharmacy/products        | Liste produits         |
| POST    | /api/pharmacy/products        | Ajouter produit        |
| PUT     | /api/pharmacy/products/:id    | Modifier produit       |
| GET     | /api/pharmacy/orders          | Liste commandes        |
| POST    | /api/pharmacy/orders          | Créer commande         |
| PATCH   | /api/pharmacy/orders/:id      | Mettre à jour          |
| GET     | /api/pharmacy/alerts          | Alertes stock          |

### Facturation
| Méthode | Endpoint                      | Description            |
|---------|-------------------------------|------------------------|
| GET     | /api/invoices                 | Liste factures         |
| GET     | /api/invoices/:id             | Détails                |
| POST    | /api/invoices                 | Créer facture          |
| PUT     | /api/invoices/:id             | Modifier               |
| PATCH   | /api/invoices/:id/pay         | Marquer payée          |
| DELETE  | /api/invoices/:id             | Annuler                |
| GET     | /api/invoices/stats           | Statistiques           |

### Notifications
| Méthode | Endpoint                         | Description            |
|---------|----------------------------------|------------------------|
| GET     | /api/notifications               | Mes notifications      |
| POST    | /api/notifications               | Créer                  |
| PATCH   | /api/notifications/:id/read      | Marquer lue            |
| POST    | /api/notifications/read-all      | Tout marquer lu        |
| DELETE  | /api/notifications/:id           | Supprimer              |

---

## 🎨 Design System

### Couleurs (HSL)
- **Primary (Teal)**: `173 58% 39%` - Couleur principale
- **Accent (Coral)**: `16 86% 63%` - Actions et alertes
- **Success**: `158 64% 52%` - Confirmations
- **Warning**: `38 92% 50%` - Avertissements
- **Destructive**: `0 84% 60%` - Erreurs
- **Info**: `199 89% 48%` - Informations

### Typographie
- **Font Family**: Outfit (Google Fonts)
- **Headings**: Bold (700)
- **Body**: Regular (400)

---

## 🚀 Déploiement

### Variables d'environnement

```env
VITE_API_URL=http://localhost:3001/api
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-key>
```

### Scripts disponibles

```bash
npm run dev      # Développement
npm run build    # Build production
npm run preview  # Preview build
npm run lint     # Linting
```

---

## 📝 Notes de développement

### Transition vers API réelle

1. Configurer `VITE_API_URL` dans `.env`
2. Les services dans `src/services/` sont prêts à l'emploi
3. Remplacer les imports de `mockData` par les appels API
4. Implémenter la gestion des erreurs et le loading state

### Bonnes pratiques

- Utiliser les types de `src/types/index.ts`
- Utiliser les services de `src/services/`
- Suivre le pattern de composants existant
- Respecter le design system (couleurs, espacements)
