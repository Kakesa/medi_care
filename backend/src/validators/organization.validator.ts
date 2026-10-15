import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.js';

const slugSchema = z.string().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Identifiant d’établissement invalide');

export const createOrganizationSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(160),
    slug: slugSchema,
    address: z.string().min(3).max(300),
    phone: z.string().min(6).max(30),
    email: z.string().email('Email invalide').max(160),
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({}).strict().optional().default({}),
});

export const updateOrganizationSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(160).optional(),
    address: z.string().min(3).max(300).optional(),
    phone: z.string().min(6).max(30).optional(),
    email: z.string().email('Email invalide').max(160).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({ id: objectIdSchema }),
});

export const listOrganizationsSchema = z.object({
  body: z.object({}).strict().optional().default({}),
  query: paginationSchema.extend({
    search: z.string().max(80).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  }),
  params: z.object({}).strict().optional().default({}),
});

export const organizationParamsSchema = z.object({
  body: z.object({}).strict().optional().default({}),
  query: z.object({}).strict().optional().default({}),
  params: z.object({ id: objectIdSchema }),
});
