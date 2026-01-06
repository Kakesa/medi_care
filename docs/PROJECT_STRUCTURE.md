# MediCare SIH - Documentation Technique

## 📋 Vue d'ensemble

MediCare SIH est un Système d'Information Hospitalier (SIH) moderne conçu pour centraliser la gestion hospitalière. Cette application permet de gérer le personnel médical, les patients, les rendez-vous, les consultations et l'accueil des malades.

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
│   │   └── ui/                # Composants UI (shadcn/ui)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       └── ... (autres composants UI)
│   │
│   ├── contexts/              # Contextes React
│   │   └── AuthContext.tsx    # Gestion de l'authentification
│   │
│   ├── data/                  # Données et types
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
│   │   ├── Index.tsx          # Page d'accueil (landing page)
│   │   ├── Login.tsx          # Page de connexion
│   │   ├── Register.tsx       # Page d'inscription
│   │   ├── Dashboard.tsx      # Tableau de bord principal
│   │   ├── Personnel.tsx      # Gestion du personnel
│   │   ├── Patients.tsx       # Gestion des patients
│   │   ├── Appointments.tsx   # Gestion des RDV
│   │   ├── Consultations.tsx  # Gestion des consultations
│   │   ├── Reception.tsx      # Accueil des patients
│   │   ├── Profile.tsx        # Profil utilisateur
│   │   └── NotFound.tsx       # Page 404
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

| Rôle         | Email                      | Mot de passe   |
|--------------|----------------------------|----------------|
| Admin        | admin@medicare.fr          | admin123       |
| Médecin      | dr.bernard@medicare.fr     | doctor123      |
| Patient      | patient@email.fr           | patient123     |
| Réceptionniste | reception@medicare.fr    | reception123   |

### Système d'authentification

L'authentification est gérée par `AuthContext.tsx` qui fournit :
- `login(email, password)` - Connexion
- `logout()` - Déconnexion
- `register(data)` - Inscription
- `updateProfile(data)` - Mise à jour du profil
- `changePassword(current, new)` - Changement de mot de passe

---

## 📊 Modèles de données

### User
```typescript
interface User {
  id: string;
  email: string;
  password: string;
  role: 'admin' | 'doctor' | 'patient' | 'receptionist';
  firstName: string;
  lastName: string;
  phone?: string;
}
```

### Patient
```typescript
interface Patient {
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
}
```

### Personnel
```typescript
interface Personnel {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'doctor' | 'nurse' | 'secretary' | 'admin' | 'receptionist';
  department: string;
  speciality?: string;
  status: 'active' | 'pending' | 'inactive';
}
```

### Appointment
```typescript
interface Appointment {
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
}
```

### Consultation
```typescript
interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  diagnosis: string;
  symptoms: string[];
  treatment: string;
  prescription?: string;
  status: 'in_progress' | 'completed';
}
```

---

## 🔌 Intégration API Backend (Node.js/Express)

### Configuration

Pour connecter l'application à un backend Node.js/Express, créez un service API :

```typescript
// src/services/api.ts

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('auth_token');
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(data: RegisterData) {
    return this.request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Patients
  async getPatients() {
    return this.request<Patient[]>('/patients');
  }

  async getPatient(id: string) {
    return this.request<Patient>(`/patients/${id}`);
  }

  async createPatient(data: Partial<Patient>) {
    return this.request<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePatient(id: string, data: Partial<Patient>) {
    return this.request<Patient>(`/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePatient(id: string) {
    return this.request<void>(`/patients/${id}`, {
      method: 'DELETE',
    });
  }

  // Personnel
  async getPersonnel() {
    return this.request<Personnel[]>('/personnel');
  }

  async createPersonnel(data: Partial<Personnel>) {
    return this.request<Personnel>('/personnel', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePersonnel(id: string, data: Partial<Personnel>) {
    return this.request<Personnel>(`/personnel/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePersonnel(id: string) {
    return this.request<void>(`/personnel/${id}`, {
      method: 'DELETE',
    });
  }

  // Appointments
  async getAppointments(date?: string) {
    const query = date ? `?date=${date}` : '';
    return this.request<Appointment[]>(`/appointments${query}`);
  }

  async createAppointment(data: Partial<Appointment>) {
    return this.request<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAppointmentStatus(id: string, status: Appointment['status']) {
    return this.request<Appointment>(`/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Consultations
  async getConsultations() {
    return this.request<Consultation[]>('/consultations');
  }

  async createConsultation(data: Partial<Consultation>) {
    return this.request<Consultation>('/consultations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Reception
  async getReceptionQueue() {
    return this.request<Reception[]>('/reception');
  }

  async registerPatientArrival(data: Partial<Reception>) {
    return this.request<Reception>('/reception', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReceptionStatus(id: string, status: Reception['status']) {
    return this.request<Reception>(`/reception/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
}

export const api = new ApiService();
```

### Variables d'environnement

Ajoutez dans `.env` :

```env
VITE_API_URL=http://localhost:3001/api
```

### Exemple de backend Express

```javascript
// server/index.js

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Middleware d'authentification
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
};

// Routes Auth
app.post('/api/auth/login', (req, res) => {
  // Logique de connexion
});

app.post('/api/auth/register', (req, res) => {
  // Logique d'inscription
});

// Routes Patients (protégées)
app.get('/api/patients', authMiddleware, (req, res) => {
  // Récupérer les patients
});

app.post('/api/patients', authMiddleware, (req, res) => {
  // Créer un patient
});

app.put('/api/patients/:id', authMiddleware, (req, res) => {
  // Modifier un patient
});

app.delete('/api/patients/:id', authMiddleware, (req, res) => {
  // Supprimer un patient
});

// Routes similaires pour personnel, appointments, consultations, reception...

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 📡 Endpoints API suggérés

### Authentification
| Méthode | Endpoint           | Description            |
|---------|-------------------|------------------------|
| POST    | /api/auth/login   | Connexion              |
| POST    | /api/auth/register| Inscription            |
| POST    | /api/auth/logout  | Déconnexion            |
| GET     | /api/auth/me      | Profil courant         |

### Patients
| Méthode | Endpoint              | Description            |
|---------|-----------------------|------------------------|
| GET     | /api/patients         | Liste des patients     |
| GET     | /api/patients/:id     | Détails d'un patient   |
| POST    | /api/patients         | Créer un patient       |
| PUT     | /api/patients/:id     | Modifier un patient    |
| DELETE  | /api/patients/:id     | Supprimer un patient   |

### Personnel
| Méthode | Endpoint              | Description            |
|---------|-----------------------|------------------------|
| GET     | /api/personnel        | Liste du personnel     |
| GET     | /api/personnel/:id    | Détails                |
| POST    | /api/personnel        | Ajouter                |
| PUT     | /api/personnel/:id    | Modifier               |
| DELETE  | /api/personnel/:id    | Supprimer              |
| PATCH   | /api/personnel/:id/status | Changer le statut  |

### Rendez-vous
| Méthode | Endpoint                    | Description            |
|---------|-----------------------------|------------------------|
| GET     | /api/appointments           | Liste des RDV          |
| GET     | /api/appointments/:id       | Détails                |
| POST    | /api/appointments           | Créer un RDV           |
| PUT     | /api/appointments/:id       | Modifier               |
| PATCH   | /api/appointments/:id/status| Changer le statut      |
| DELETE  | /api/appointments/:id       | Annuler                |

### Consultations
| Méthode | Endpoint                      | Description            |
|---------|-------------------------------|------------------------|
| GET     | /api/consultations            | Liste                  |
| GET     | /api/consultations/:id        | Détails                |
| POST    | /api/consultations            | Créer                  |
| PUT     | /api/consultations/:id        | Modifier               |
| PATCH   | /api/consultations/:id/status | Terminer               |

### Réception
| Méthode | Endpoint                  | Description            |
|---------|---------------------------|------------------------|
| GET     | /api/reception            | File d'attente         |
| POST    | /api/reception            | Enregistrer arrivée    |
| PATCH   | /api/reception/:id/status | Changer statut         |

---

## 🎨 Design System

### Couleurs (HSL)
- **Primary (Teal)**: `173 58% 39%` - Couleur principale
- **Accent (Coral)**: `16 86% 63%` - Actions et alertes
- **Success**: `158 64% 52%` - Confirmations
- **Warning**: `38 92% 50%` - Avertissements
- **Destructive**: `0 84% 60%` - Erreurs

### Typographie
- **Font Family**: Outfit (Google Fonts)
- **Headings**: Bold (700)
- **Body**: Regular (400)

---

## 🚀 Déploiement

### Production Build
```bash
npm run build
```

### Variables d'environnement production
```env
VITE_API_URL=https://api.votre-domaine.com/api
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-key
```

---

## 📝 License

© 2024 MediCare SIH - Système conforme RGPD et normes HL7.
