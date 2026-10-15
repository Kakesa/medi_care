import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.js';

const empty = z.object({}).optional().default({});
const paramsId = z.object({ id: objectIdSchema });
const paramsPatient = z.object({ patientId: objectIdSchema });
const paramsDoctor = z.object({ doctorId: objectIdSchema });
const paramsDate = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide') });

function envelope(body: z.ZodTypeAny, query: z.ZodTypeAny = empty, params: z.ZodTypeAny = empty) {
  return z.object({ body, query, params });
}

const optionalText = z.string().max(2000).optional();

export const listPersonnelSchema = envelope(
  empty,
  paginationSchema.extend({
    role: z.enum(['doctor', 'nurse', 'receptionist', 'admin', 'secretary']).optional(),
    department: z.string().max(80).optional(),
    status: z.enum(['active', 'pending', 'inactive']).optional(),
    search: z.string().max(80).optional(),
  })
);

export const createPersonnelSchema = envelope(
  z.object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    email: z.string().email().max(160),
    phone: z.string().max(30).optional(),
    role: z.enum(['doctor', 'nurse', 'receptionist', 'admin', 'secretary']),
    department: z.string().min(1).max(80),
    speciality: optionalText,
    status: z.enum(['active', 'pending', 'inactive']).optional(),
  })
);

export const updatePersonnelSchema = envelope(
  z.object({
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    email: z.string().email().max(160).optional(),
    phone: z.string().max(30).optional(),
    role: z.enum(['doctor', 'nurse', 'receptionist', 'admin', 'secretary']).optional(),
    department: z.string().min(1).max(80).optional(),
    speciality: optionalText,
    status: z.enum(['active', 'pending', 'inactive']).optional(),
  }),
  empty,
  paramsId
);

export const personnelStatusSchema = envelope(
  z.object({ status: z.enum(['active', 'pending', 'inactive']) }),
  empty,
  paramsId
);

export const personnelParamsSchema = envelope(empty, empty, paramsId);

const appointmentBody = {
  patientId: objectIdSchema,
  doctorId: objectIdSchema,
  patientName: z.string().max(160).optional(),
  doctorName: z.string().max(160).optional(),
  date: z.coerce.date(),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Heure invalide'),
  duration: z.coerce.number().int().min(5).max(480),
  type: z.enum(['consultation', 'followup', 'exam', 'emergency']),
  notes: optionalText,
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
};

export const listAppointmentsSchema = envelope(
  empty,
  paginationSchema.extend({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    doctorId: objectIdSchema.optional(),
    patientId: objectIdSchema.optional(),
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
  })
);

export const createAppointmentSchema = envelope(z.object(appointmentBody));
export const updateAppointmentSchema = envelope(
  z.object({
    patientId: objectIdSchema.optional(),
    doctorId: objectIdSchema.optional(),
    patientName: z.string().max(160).optional(),
    doctorName: z.string().max(160).optional(),
    date: z.coerce.date().optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    duration: z.coerce.number().int().min(5).max(480).optional(),
    type: z.enum(['consultation', 'followup', 'exam', 'emergency']).optional(),
    notes: optionalText,
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
  }),
  empty,
  paramsId
);
export const appointmentStatusSchema = envelope(
  z.object({ status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']) }),
  empty,
  paramsId
);
export const appointmentParamsSchema = envelope(empty, empty, paramsId);
export const appointmentByDateSchema = envelope(empty, empty, paramsDate);
export const appointmentByDoctorSchema = envelope(empty, empty, paramsDoctor);
export const appointmentByPatientSchema = envelope(empty, empty, paramsPatient);

const consultationWrite = {
  patientId: objectIdSchema,
  doctorId: objectIdSchema,
  patientName: z.string().max(160).optional(),
  doctorName: z.string().max(160).optional(),
  appointmentId: objectIdSchema.optional(),
  diagnosis: z.string().max(2000).optional().default(''),
  symptoms: z.array(z.string().max(200)).max(40).optional().default([]),
  treatment: z.string().max(4000).optional().default(''),
  prescription: optionalText,
  notes: optionalText,
  followUpDate: z.union([z.coerce.date(), z.literal('')]).optional(),
  date: z.coerce.date().optional(),
  status: z.enum(['in_progress', 'completed']).optional(),
};

export const listConsultationsSchema = envelope(empty, paginationSchema);
export const createConsultationSchema = envelope(z.object(consultationWrite));
export const updateConsultationSchema = envelope(
  z.object({
    ...consultationWrite,
    patientId: objectIdSchema.optional(),
    doctorId: objectIdSchema.optional(),
    diagnosis: z.string().max(2000).optional(),
    symptoms: z.array(z.string().max(200)).max(40).optional(),
    treatment: z.string().max(4000).optional(),
  }),
  empty,
  paramsId
);
export const consultationParamsSchema = envelope(empty, empty, paramsId);
export const consultationByDoctorSchema = envelope(empty, empty, paramsDoctor);
export const consultationByPatientSchema = envelope(empty, empty, paramsPatient);

export const listReceptionSchema = envelope(empty, paginationSchema);
export const createReceptionSchema = envelope(
  z.object({
    patientId: objectIdSchema,
    patientName: z.string().max(160).optional(),
    reason: z.string().min(1).max(500),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    notes: optionalText,
  })
);
export const updateReceptionSchema = envelope(
  z.object({
    reason: z.string().min(1).max(500).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    notes: optionalText,
    status: z.enum(['waiting', 'in_consultation', 'completed', 'cancelled']).optional(),
    assignedDoctor: z.string().max(160).optional(),
  }),
  empty,
  paramsId
);
export const receptionStatusSchema = envelope(
  z.object({
    status: z.enum(['waiting', 'in_consultation', 'completed', 'cancelled']),
    assignedDoctor: z.string().max(160).optional(),
  }),
  empty,
  paramsId
);
export const receptionAssignSchema = envelope(z.object({ doctorId: objectIdSchema }), empty, paramsId);
export const receptionParamsSchema = envelope(empty, empty, paramsId);

export const listExamsSchema = envelope(
  empty,
  paginationSchema.extend({
    type: z.enum(['laboratory', 'imaging', 'biopsy', 'other']).optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
    patientId: objectIdSchema.optional(),
    doctorId: objectIdSchema.optional(),
  })
);
export const createExamSchema = envelope(
  z.object({
    patientId: objectIdSchema,
    doctorId: objectIdSchema,
    patientName: z.string().max(160).optional(),
    doctorName: z.string().max(160).optional(),
    type: z.enum(['laboratory', 'imaging', 'biopsy', 'other']),
    category: z.string().min(1).max(80),
    name: z.string().min(1).max(160),
    date: z.coerce.date(),
    notes: optionalText,
    results: optionalText,
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  })
);
export const updateExamSchema = envelope(
  z.object({
    patientId: objectIdSchema.optional(),
    doctorId: objectIdSchema.optional(),
    patientName: z.string().max(160).optional(),
    doctorName: z.string().max(160).optional(),
    type: z.enum(['laboratory', 'imaging', 'biopsy', 'other']).optional(),
    category: z.string().min(1).max(80).optional(),
    name: z.string().min(1).max(160).optional(),
    date: z.coerce.date().optional(),
    notes: optionalText,
    results: optionalText,
    files: z.array(z.string().max(500)).max(20).optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  }),
  empty,
  paramsId
);
export const examStatusSchema = envelope(
  z.object({ status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']) }),
  empty,
  paramsId
);
export const examResultsSchema = envelope(
  z.object({
    results: z.string().max(8000),
    files: z.array(z.string().max(500)).max(20).optional(),
  }),
  empty,
  paramsId
);
export const examParamsSchema = envelope(empty, empty, paramsId);
export const examByPatientSchema = envelope(empty, empty, paramsPatient);

const productBody = {
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(80),
  quantity: z.coerce.number().int().min(0),
  minStock: z.coerce.number().int().min(0),
  unit: z.string().min(1).max(40),
  price: z.coerce.number().min(0),
  supplier: z.string().max(160).optional().default(''),
  expiryDate: z.union([z.coerce.date(), z.literal('')]).optional(),
};

export const listPharmacySchema = envelope(empty, paginationSchema);
export const createProductSchema = envelope(z.object(productBody));
export const updateProductSchema = envelope(
  z.object({
    name: z.string().min(1).max(160).optional(),
    category: z.string().min(1).max(80).optional(),
    quantity: z.coerce.number().int().min(0).optional(),
    minStock: z.coerce.number().int().min(0).optional(),
    unit: z.string().min(1).max(40).optional(),
    price: z.coerce.number().min(0).optional(),
    supplier: z.string().max(160).optional(),
    expiryDate: z.union([z.coerce.date(), z.literal('')]).optional(),
  }),
  empty,
  paramsId
);
export const productStockSchema = envelope(z.object({ quantity: z.coerce.number().int().min(0) }), empty, paramsId);
export const productParamsSchema = envelope(empty, empty, paramsId);
export const createOrderSchema = envelope(
  z.object({
    productId: objectIdSchema,
    productName: z.string().max(160).optional(),
    quantity: z.coerce.number().int().min(1),
    supplier: z.string().max(160).optional(),
    expectedDelivery: z.union([z.coerce.date(), z.literal('')]).optional(),
    notes: optionalText,
  })
);
export const orderStatusSchema = envelope(
  z.object({ status: z.enum(['pending', 'confirmed', 'delivered', 'cancelled']) }),
  empty,
  paramsId
);
export const orderParamsSchema = envelope(empty, empty, paramsId);

const invoiceItem = z.object({
  id: z.string().optional(),
  description: z.string().min(1).max(300),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
  total: z.coerce.number().min(0).optional(),
  type: z.enum(['consultation', 'exam', 'medication', 'service']).optional(),
  referenceId: z.string().max(80).optional(),
});

export const listInvoicesSchema = envelope(
  empty,
  paginationSchema.extend({
    status: z.enum(['pending', 'paid', 'cancelled', 'overdue']).optional(),
    patientId: objectIdSchema.optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
);
export const createInvoiceSchema = envelope(
  z.object({
    patientId: objectIdSchema,
    patientName: z.string().max(160).optional(),
    patientAddress: z.string().max(300).optional(),
    patientPhone: z.string().max(30).optional(),
    items: z.array(invoiceItem).min(1).max(50),
    tax: z.coerce.number().min(0).optional(),
    discount: z.coerce.number().min(0).optional(),
    dueDate: z.coerce.date().optional(),
    notes: optionalText,
  })
);
export const updateInvoiceSchema = envelope(
  z.object({
    items: z.array(invoiceItem).min(1).max(50).optional(),
    dueDate: z.coerce.date().optional(),
    notes: optionalText,
    patientName: z.string().max(160).optional(),
  }),
  empty,
  paramsId
);
export const payInvoiceSchema = envelope(
  z.object({ paymentMethod: z.enum(['cash', 'card', 'transfer', 'insurance']) }),
  empty,
  paramsId
);
export const invoiceParamsSchema = envelope(empty, empty, paramsId);
export const invoiceByPatientSchema = envelope(empty, empty, paramsPatient);
