# MediCare SIH - Architecture API

## 📐 Vue d'ensemble de l'architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (React + Vite)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │   Pages/Views   │────▶│    Contexts     │◀────│    Services     │       │
│  │                 │     │ (Auth, Notif)   │     │ (API Calls)     │       │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘       │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │   Components    │     │     Hooks       │     │   HttpClient    │       │
│  │   (UI/Forms)    │     │  (useToast...)  │     │   (Fetch API)   │       │
│  └─────────────────┘     └─────────────────┘     └────────┬────────┘       │
│                                                           │                 │
└───────────────────────────────────────────────────────────┼─────────────────┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY / BACKEND                             │
│                         (Node.js + Express / Supabase)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │   Auth Routes   │     │  CRUD Routes    │     │  Middlewares    │       │
│  │   /api/auth/*   │     │  /api/*         │     │  (JWT, CORS)    │       │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                      Business Logic Layer                        │       │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │       │
│  │  │ Patients │ │Personnel │ │   RDV    │ │ Consult  │ │ Exams  │ │       │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │       │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │       │
│  │  │Reception │ │ Pharmacy │ │ Billing  │ │  Notif   │           │       │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└───────────────────────────────────────────────────────────────────────────┬─┘
                                                                            │
                                                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE LAYER                                 │
│                           (PostgreSQL / Supabase)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │    users    │ │  patients   │ │  personnel  │ │appointments │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │consultations│ │    exams    │ │  invoices   │ │notifications│           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                           │
│  │  reception  │ │  products   │ │   orders    │                           │
│  └─────────────┘ └─────────────┘ └─────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Structure des Services Frontend

```
src/services/
├── config.ts              # Configuration API (URL, headers, tokens)
├── httpClient.ts          # Client HTTP centralisé
├── authService.ts         # Authentification
├── patientService.ts      # Gestion patients
├── personnelService.ts    # Gestion personnel
├── appointmentService.ts  # Gestion RDV
├── consultationService.ts # Gestion consultations
├── receptionService.ts    # Gestion réception
├── examService.ts         # Gestion examens
├── pharmacyService.ts     # Gestion pharmacie
├── billingService.ts      # Gestion facturation
├── notificationService.ts # Gestion notifications
└── index.ts               # Export unifié
```

---

## 🔧 Configuration (`config.ts`)

```typescript
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  TIMEOUT: 10000,
  HEADERS: {
    'Content-Type': 'application/json',
  },
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('auth_token');
};
```

---

## 🌐 HTTP Client (`httpClient.ts`)

Le client HTTP centralise toutes les requêtes avec:
- **Intercepteur d'authentification** : Ajoute automatiquement le token JWT
- **Gestion des erreurs** : Capture et formate les erreurs HTTP
- **Méthodes CRUD** : `get`, `post`, `put`, `patch`, `delete`

```typescript
class HttpClient {
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T>
  async post<T>(endpoint: string, data?: unknown): Promise<T>
  async put<T>(endpoint: string, data?: unknown): Promise<T>
  async patch<T>(endpoint: string, data?: unknown): Promise<T>
  async delete<T>(endpoint: string): Promise<T>
}
```

---

## 📡 Services API

### 1. AuthService (`authService.ts`)

```typescript
const authService = {
  login(credentials: LoginCredentials): Promise<AuthResponse>
  register(data: RegisterData): Promise<AuthResponse>
  logout(): Promise<void>
  getCurrentUser(): Promise<User>
  updateProfile(data: Partial<User>): Promise<User>
  changePassword(currentPassword: string, newPassword: string): Promise<void>
}
```

**Endpoints:**
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/login` | Connexion utilisateur |
| POST | `/auth/register` | Inscription |
| POST | `/auth/logout` | Déconnexion |
| GET | `/auth/me` | Profil courant |
| PUT | `/auth/profile` | Mise à jour profil |
| PUT | `/auth/password` | Changer mot de passe |

---

### 2. PatientService (`patientService.ts`)

```typescript
const patientService = {
  getAll(params?: PatientQueryParams): Promise<PaginatedResponse<Patient>>
  getById(id: string): Promise<Patient>
  create(data: CreatePatientData): Promise<Patient>
  update(id: string, data: UpdatePatientData): Promise<Patient>
  delete(id: string): Promise<void>
  search(query: string): Promise<Patient[]>
  getStats(): Promise<PatientStats>
}
```

**Endpoints:**
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/patients` | Liste paginée |
| GET | `/patients/:id` | Détails patient |
| POST | `/patients` | Créer patient |
| PUT | `/patients/:id` | Modifier patient |
| DELETE | `/patients/:id` | Supprimer patient |
| GET | `/patients/search` | Recherche |
| GET | `/patients/stats` | Statistiques |

---

### 3. PersonnelService (`personnelService.ts`)

```typescript
const personnelService = {
  getAll(params?: PersonnelQueryParams): Promise<PaginatedResponse<Personnel>>
  getById(id: string): Promise<Personnel>
  create(data: CreatePersonnelData): Promise<Personnel>
  update(id: string, data: UpdatePersonnelData): Promise<Personnel>
  delete(id: string): Promise<void>
  updateStatus(id: string, status: PersonnelStatus): Promise<Personnel>
  getByDepartment(department: string): Promise<Personnel[]>
  getDoctors(): Promise<Personnel[]>
}
```

**Endpoints:**
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/personnel` | Liste paginée |
| GET | `/personnel/:id` | Détails |
| POST | `/personnel` | Ajouter |
| PUT | `/personnel/:id` | Modifier |
| DELETE | `/personnel/:id` | Supprimer |
| PATCH | `/personnel/:id/status` | Changer statut |
| GET | `/personnel/department/:dept` | Par département |
| GET | `/personnel/doctors` | Liste médecins |

---

### 4. AppointmentService (`appointmentService.ts`)

```typescript
const appointmentService = {
  getAll(params?: AppointmentQueryParams): Promise<PaginatedResponse<Appointment>>
  getById(id: string): Promise<Appointment>
  create(data: CreateAppointmentData): Promise<Appointment>
  update(id: string, data: UpdateAppointmentData): Promise<Appointment>
  delete(id: string): Promise<void>
  updateStatus(id: string, status: AppointmentStatus): Promise<Appointment>
  getByDate(date: string): Promise<Appointment[]>
  getByDoctor(doctorId: string): Promise<Appointment[]>
  getByPatient(patientId: string): Promise<Appointment[]>
  getAvailableSlots(doctorId: string, date: string): Promise<string[]>
}
```

**Endpoints:**
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/appointments` | Liste paginée |
| GET | `/appointments/:id` | Détails |
| POST | `/appointments` | Créer RDV |
| PUT | `/appointments/:id` | Modifier |
| DELETE | `/appointments/:id` | Annuler |
| PATCH | `/appointments/:id/status` | Changer statut |
| GET | `/appointments/date/:date` | Par date |
| GET | `/appointments/doctor/:id` | Par médecin |
| GET | `/appointments/patient/:id` | Par patient |
| GET | `/appointments/slots` | Créneaux libres |

---

### 5. ConsultationService (`consultationService.ts`)

```typescript
const consultationService = {
  getAll(params?: PaginationParams): Promise<PaginatedResponse<Consultation>>
  getById(id: string): Promise<Consultation>
  create(data: CreateConsultationData): Promise<Consultation>
  update(id: string, data: UpdateConsultationData): Promise<Consultation>
  complete(id: string): Promise<Consultation>
  getByDoctor(doctorId: string): Promise<Consultation[]>
  getByPatient(patientId: string): Promise<Consultation[]>
}
```

**Endpoints:**
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/consultations` | Liste |
| GET | `/consultations/:id` | Détails |
| POST | `/consultations` | Créer |
| PUT | `/consultations/:id` | Modifier |
| PATCH | `/consultations/:id/complete` | Terminer |
| GET | `/consultations/doctor/:id` | Par médecin |
| GET | `/consultations/patient/:id` | Par patient |

---

### 6. ExamService (`examService.ts`)

```typescript
const examService = {
  getAll(params?: ExamQueryParams): Promise<PaginatedResponse<Exam>>
  getById(id: string): Promise<Exam>
  create(data: CreateExamData): Promise<Exam>
  update(id: string, data: UpdateExamData): Promise<Exam>
  delete(id: string): Promise<void>
  addResults(id: string, results: string, files?: string[]): Promise<Exam>
  getByType(type: ExamType): Promise<Exam[]>
  getByPatient(patientId: string): Promise<Exam[]>
}
```

**Endpoints:**
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/exams` | Liste |
| GET | `/exams/:id` | Détails |
| POST | `/exams` | Créer |
| PUT | `/exams/:id` | Modifier |
| DELETE | `/exams/:id` | Supprimer |
| PATCH | `/exams/:id/results` | Ajouter résultats |
| GET | `/exams/type/:type` | Par type |
| GET | `/exams/patient/:id` | Par patient |

---

### 7. PharmacyService (`pharmacyService.ts`)

```typescript
const pharmacyService = {
  // Products
  getAllProducts(params?: PaginationParams): Promise<PaginatedResponse<PharmacyProduct>>
  getProductById(id: string): Promise<PharmacyProduct>
  createProduct(data: CreateProductData): Promise<PharmacyProduct>
  updateProduct(id: string, data: UpdateProductData): Promise<PharmacyProduct>
  deleteProduct(id: string): Promise<void>
  updateStock(id: string, quantity: number): Promise<PharmacyProduct>
  getLowStockProducts(): Promise<PharmacyProduct[]>
  
  // Orders
  getAllOrders(): Promise<PharmacyOrder[]>
  createOrder(data: CreateOrderData): Promise<PharmacyOrder>
  updateOrderStatus(id: string, status: OrderStatus): Promise<PharmacyOrder>
}
```

**Endpoints:**
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/pharmacy/products` | Liste produits |
| POST | `/pharmacy/products` | Ajouter produit |
| PUT | `/pharmacy/products/:id` | Modifier produit |
| DELETE | `/pharmacy/products/:id` | Supprimer |
| PATCH | `/pharmacy/products/:id/stock` | Mise à jour stock |
| GET | `/pharmacy/products/low-stock` | Alertes stock |
| GET | `/pharmacy/orders` | Liste commandes |
| POST | `/pharmacy/orders` | Créer commande |
| PATCH | `/pharmacy/orders/:id/status` | Statut commande |

---

### 8. BillingService (`billingService.ts`)

```typescript
const billingService = {
  getAll(params?: InvoiceQueryParams): Promise<PaginatedResponse<Invoice>>
  getById(id: string): Promise<Invoice>
  create(data: CreateInvoiceData): Promise<Invoice>
  update(id: string, data: UpdateInvoiceData): Promise<Invoice>
  delete(id: string): Promise<void>
  markAsPaid(id: string, paymentMethod: PaymentMethod): Promise<Invoice>
  getByPatient(patientId: string): Promise<Invoice[]>
  getStats(startDate?: string, endDate?: string): Promise<BillingStats>
}
```

**Endpoints:**
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/invoices` | Liste factures |
| GET | `/invoices/:id` | Détails |
| POST | `/invoices` | Créer facture |
| PUT | `/invoices/:id` | Modifier |
| DELETE | `/invoices/:id` | Annuler |
| PATCH | `/invoices/:id/pay` | Marquer payée |
| GET | `/invoices/patient/:id` | Par patient |
| GET | `/invoices/stats` | Statistiques |

---

### 9. ReceptionService (`receptionService.ts`)

```typescript
const receptionService = {
  getQueue(): Promise<Reception[]>
  registerArrival(data: CreateReceptionData): Promise<Reception>
  updateStatus(id: string, status: ReceptionStatus): Promise<Reception>
  assignDoctor(id: string, doctorId: string): Promise<Reception>
  getWaitingPatients(): Promise<Reception[]>
  callNext(): Promise<Reception>
}
```

**Endpoints:**
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/reception` | File d'attente |
| POST | `/reception` | Enregistrer arrivée |
| PATCH | `/reception/:id/status` | Changer statut |
| PATCH | `/reception/:id/doctor` | Assigner médecin |
| GET | `/reception/waiting` | Patients en attente |
| POST | `/reception/next` | Appeler suivant |

---

### 10. NotificationService (`notificationService.ts`)

```typescript
const notificationService = {
  getAll(userId?: string): Promise<Notification[]>
  create(data: CreateNotificationData): Promise<Notification>
  markAsRead(id: string): Promise<Notification>
  markAllAsRead(userId: string): Promise<void>
  delete(id: string): Promise<void>
  getUnreadCount(userId: string): Promise<number>
}
```

**Endpoints:**
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/notifications` | Mes notifications |
| POST | `/notifications` | Créer |
| PATCH | `/notifications/:id/read` | Marquer lue |
| POST | `/notifications/read-all` | Tout marquer lu |
| DELETE | `/notifications/:id` | Supprimer |
| GET | `/notifications/unread-count` | Nombre non lues |

---

## 🔒 Sécurité

### Authentification JWT

```
┌──────────┐     1. Login      ┌──────────┐
│  Client  │ ─────────────────▶│  Server  │
│          │◀───────────────── │          │
└──────────┘   2. JWT Token    └──────────┘
     │
     │ 3. Request + Authorization: Bearer <token>
     ▼
┌──────────┐                   ┌──────────┐
│  Client  │ ─────────────────▶│  Server  │
│          │◀───────────────── │          │
└──────────┘   4. Response     └──────────┘
```

### Middleware d'authentification

```typescript
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
};
```

### Contrôle d'accès par rôle

```typescript
const roleMiddleware = (allowedRoles: string[]) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    next();
  };
};

// Utilisation
app.get('/api/personnel', authMiddleware, roleMiddleware(['admin']), getPersonnel);
```

---

## 📊 Schéma de Base de Données

```sql
-- Users (authentification)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'doctor', 'patient', 'receptionist')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Patients
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  date_of_birth DATE NOT NULL,
  gender CHAR(1) CHECK (gender IN ('M', 'F')),
  address TEXT,
  blood_type VARCHAR(5),
  allergies TEXT[],
  status VARCHAR(20) DEFAULT 'outpatient',
  room VARCHAR(20),
  admission_date TIMESTAMP,
  discharge_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Personnel
CREATE TABLE personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  role VARCHAR(50) NOT NULL,
  department VARCHAR(100),
  speciality VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  hire_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES personnel(id),
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER DEFAULT 30,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Consultations
CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES personnel(id),
  appointment_id UUID REFERENCES appointments(id),
  date TIMESTAMP DEFAULT NOW(),
  diagnosis TEXT,
  symptoms TEXT[],
  treatment TEXT,
  prescription TEXT,
  notes TEXT,
  follow_up_date DATE,
  status VARCHAR(20) DEFAULT 'in_progress'
);

-- Exams
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES personnel(id),
  type VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  name VARCHAR(200) NOT NULL,
  date TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending',
  results TEXT,
  files TEXT[],
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id),
  subtotal DECIMAL(10, 2),
  tax DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2),
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(20),
  paid_at TIMESTAMP,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Invoice Items
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10, 2),
  total DECIMAL(10, 2),
  type VARCHAR(50),
  reference_id UUID
);

-- Reception Queue
CREATE TABLE reception (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  arrival_time TIMESTAMP DEFAULT NOW(),
  reason TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'waiting',
  assigned_doctor UUID REFERENCES personnel(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pharmacy Products
CREATE TABLE pharmacy_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 10,
  unit VARCHAR(50),
  price DECIMAL(10, 2),
  supplier VARCHAR(200),
  expiry_date DATE,
  status VARCHAR(20) DEFAULT 'in_stock',
  last_restocked TIMESTAMP
);

-- Pharmacy Orders
CREATE TABLE pharmacy_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES pharmacy_products(id),
  quantity INTEGER NOT NULL,
  supplier VARCHAR(200),
  order_date TIMESTAMP DEFAULT NOW(),
  expected_delivery DATE,
  status VARCHAR(20) DEFAULT 'pending',
  total_cost DECIMAL(10, 2),
  notes TEXT
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  related_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 Utilisation

### Import des services

```typescript
import { 
  authService,
  patientService, 
  personnelService,
  appointmentService,
  consultationService,
  receptionService,
  examService,
  pharmacyService,
  billingService,
  notificationService
} from '@/services';
```

### Exemples d'utilisation

```typescript
// Authentification
const { token, user } = await authService.login({ 
  email: 'admin@medicare.fr', 
  password: 'admin123' 
});

// Récupérer les patients
const { data: patients, total } = await patientService.getAll({ 
  page: 1, 
  limit: 10 
});

// Créer un RDV
const appointment = await appointmentService.create({
  patientId: 'pat-1',
  patientName: 'Jean Martin',
  doctorId: 'doc-1',
  doctorName: 'Dr. Bernard',
  date: '2024-01-20',
  time: '10:00',
  duration: 30,
  type: 'consultation'
});

// Générer une facture
const invoice = await billingService.create({
  patientId: 'pat-1',
  patientName: 'Jean Martin',
  items: [
    { description: 'Consultation', quantity: 1, unitPrice: 50, total: 50, type: 'consultation' }
  ],
  dueDate: '2024-02-20'
});
```

---

## 📝 Variables d'environnement

```env
# API Configuration
VITE_API_URL=http://localhost:3001/api

# JWT Configuration (Backend)
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Database (Backend)
DATABASE_URL=postgresql://user:password@localhost:5432/medicare_db

# Supabase (Alternative)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```
