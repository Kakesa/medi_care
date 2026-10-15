import { z } from 'zod';
import { ASSIGNABLE_ROLES } from '../config/permissions.js';
import { objectIdSchema, paginationSchema } from './common.js';

const passwordSchema = z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').max(128);

const userBody = {
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email('Email invalide').max(160),
  phone: z.string().max(30).optional(),
  password: passwordSchema,
  role: z.enum(ASSIGNABLE_ROLES),
};

export const createUserSchema = z.object({
  body: z.object(userBody).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({}).strict().optional().default({}),
});

export const createOrganizationUserSchema = z.object({
  body: z.object(userBody).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({ id: objectIdSchema }),
});

export const updateUserRoleSchema = z.object({
  body: z.object({
    role: z.enum(ASSIGNABLE_ROLES),
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({ id: objectIdSchema }),
});

export const updateUserStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({ id: objectIdSchema }),
});

export const listUsersSchema = z.object({
  body: z.object({}).strict().optional().default({}),
  query: paginationSchema.extend({
    search: z.string().max(80).optional(),
    role: z.enum(ASSIGNABLE_ROLES).optional(),
  }),
  params: z.object({}).strict().optional().default({}),
});
