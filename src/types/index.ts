// ============================================
// Types centralisés pour l'application SIH
// ============================================

// ============ Enums ============

export type UserRole = 'admin' | 'doctor' | 'patient' | 'receptionist';
export type PersonnelRole = 'doctor' | 'nurse' | 'secretary' | 'admin' | 'receptionist';
export type PersonnelStatus = 'active' | 'pending' | 'inactive';
export type PatientStatus = 'hospitalized' | 'outpatient' | 'discharged';
export type Gender = 'M' | 'F';
export type AppointmentType = 'consultation' | 'followup' | 'exam' | 'emergency';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type ConsultationStatus = 'in_progress' | 'completed';
export type ReceptionPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ReceptionStatus = 'waiting' | 'in_consultation' | 'completed' | 'cancelled';
export type ExamType = 'laboratory' | 'imaging' | 'biopsy' | 'other';
export type ExamStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type NotificationType = 'appointment' | 'patient_arrival' | 'exam_result' | 'pharmacy' | 'general' | 'billing';
export type ProductStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';
export type InvoiceStatus = 'pending' | 'paid' | 'cancelled' | 'overdue';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'insurance';

// ============ User & Auth ============

export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ============ Personnel ============

export interface Personnel {
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

export interface CreatePersonnelData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: PersonnelRole;
  department: string;
  speciality?: string;
}

export interface UpdatePersonnelData extends Partial<CreatePersonnelData> {
  status?: PersonnelStatus;
}

// ============ Patient ============

export interface Patient {
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

export interface CreatePatientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  address: string;
  bloodType?: string;
  allergies?: string[];
}

export interface UpdatePatientData extends Partial<CreatePatientData> {
  status?: PatientStatus;
  room?: string;
}

// ============ Appointment ============

export interface Appointment {
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

export interface CreateAppointmentData {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  duration: number;
  type: AppointmentType;
  notes?: string;
}

export interface UpdateAppointmentData extends Partial<CreateAppointmentData> {
  status?: AppointmentStatus;
}

// ============ Consultation ============

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
  status: ConsultationStatus;
}

export interface CreateConsultationData {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  appointmentId?: string;
  diagnosis: string;
  symptoms: string[];
  treatment: string;
  prescription?: string;
  notes?: string;
  followUpDate?: string;
}

export interface UpdateConsultationData extends Partial<CreateConsultationData> {
  status?: ConsultationStatus;
}

// ============ Reception ============

export interface Reception {
  id: string;
  patientId: string;
  patientName: string;
  arrivalTime: string;
  reason: string;
  priority: ReceptionPriority;
  status: ReceptionStatus;
  assignedDoctor?: string;
  notes?: string;
  createdAt: string;
}

export interface CreateReceptionData {
  patientId: string;
  patientName: string;
  reason: string;
  priority: ReceptionPriority;
  notes?: string;
}

export interface UpdateReceptionData extends Partial<CreateReceptionData> {
  status?: ReceptionStatus;
  assignedDoctor?: string;
}

// ============ Exam ============

export interface Exam {
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

export interface CreateExamData {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  type: ExamType;
  category: string;
  name: string;
  date: string;
  notes?: string;
}

export interface UpdateExamData extends Partial<CreateExamData> {
  status?: ExamStatus;
  results?: string;
  files?: string[];
}

// ============ Notification ============

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  userId?: string;
  relatedId?: string;
  createdAt: string;
}

export interface CreateNotificationData {
  type: NotificationType;
  title: string;
  message: string;
  userId?: string;
  relatedId?: string;
}

// ============ Pharmacy ============

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
  status: ProductStatus;
  lastRestocked?: string;
}

export interface CreateProductData {
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  unit: string;
  price: number;
  supplier: string;
  expiryDate?: string;
}

export interface UpdateProductData extends Partial<CreateProductData> {
  status?: ProductStatus;
}

export interface PharmacyOrder {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  supplier: string;
  orderDate: string;
  expectedDelivery?: string;
  status: OrderStatus;
  totalCost: number;
  notes?: string;
}

export interface CreateOrderData {
  productId: string;
  productName: string;
  quantity: number;
  supplier: string;
  expectedDelivery?: string;
  notes?: string;
}

// ============ Billing / Invoice ============

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  type: 'consultation' | 'exam' | 'medication' | 'service';
  referenceId?: string;
}

export interface Invoice {
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

export interface CreateInvoiceData {
  patientId: string;
  patientName: string;
  patientAddress?: string;
  patientPhone?: string;
  items: Omit<InvoiceItem, 'id'>[];
  tax?: number;
  discount?: number;
  dueDate: string;
  notes?: string;
}

export interface UpdateInvoiceData extends Partial<CreateInvoiceData> {
  status?: InvoiceStatus;
  paymentMethod?: PaymentMethod;
}

// ============ API Response Types ============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

// ============ Query Params ============

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface AppointmentQueryParams extends PaginationParams {
  date?: string;
  doctorId?: string;
  patientId?: string;
  status?: AppointmentStatus;
}

export interface PatientQueryParams extends PaginationParams {
  status?: PatientStatus;
  search?: string;
}

export interface PersonnelQueryParams extends PaginationParams {
  role?: PersonnelRole;
  department?: string;
  status?: PersonnelStatus;
}

export interface ExamQueryParams extends PaginationParams {
  type?: ExamType;
  status?: ExamStatus;
  patientId?: string;
  doctorId?: string;
}

export interface InvoiceQueryParams extends PaginationParams {
  status?: InvoiceStatus;
  patientId?: string;
  startDate?: string;
  endDate?: string;
}
