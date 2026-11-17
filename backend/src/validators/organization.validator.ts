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
    facilityType: z.string().max(40).optional(),
    registrationNumber: z.string().max(80).optional(),
    commune: z.string().max(80).optional(),
    city: z.string().max(80).optional(),
    province: z.string().max(80).optional(),
    country: z.string().max(80).optional(),
    currency: z.enum(['EUR', 'CDF', 'USD']).optional(),
    timezone: z.string().max(60).optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({ id: objectIdSchema }),
});

export const listOrganizationsSchema = z.object({
  body: z.object({}).strict().optional().default({}),
  query: paginationSchema.extend({
    search: z.string().max(80).optional(),
    status: z.enum(['pending', 'active', 'suspended', 'rejected']).optional(),
  }),
  params: z.object({}).strict().optional().default({}),
});

const imageField = z.string().max(2_200_000).refine((value) => value.startsWith('data:image/') || value.startsWith('https://'), 'Image invalide');

const hospitalApplicationFields = {
  admin: z.object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    postName: z.string().min(1).max(80),
    email: z.string().email('Email invalide').max(160),
    phone: z.string().min(6).max(30),
    jobTitle: z.string().min(2).max(80),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  }).strict(),
  center: z.object({
    name: z.string().min(2).max(160),
    facilityType: z.enum(['hopital', 'clinique', 'centre_sante', 'polyclinique', 'autre']),
    registrationNumber: z.string().min(2).max(80),
    address: z.string().min(3).max(300),
    commune: z.string().min(2).max(80),
    city: z.string().min(2).max(80),
    province: z.string().min(2).max(80),
    country: z.string().min(2).max(80),
    phone: z.string().min(6).max(30),
    email: z.string().email('Email invalide').max(160),
    logo: imageField,
    coverImage: imageField.optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    currency: z.enum(['EUR', 'CDF', 'USD']),
    timezone: z.string().min(3).max(60),
    stamp: imageField.optional(),
  }).strict(),
};

const website = z.string().max(0, 'Requête refusée').optional();

export const hospitalApplicationSchema = z.object({
  body: z.object({ ...hospitalApplicationFields, website }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({}).strict().optional().default({}),
});

export const hospitalResubmitSchema = z.object({
  body: z.object({
    email: z.string().email().max(160),
    password: z.string().min(8).max(128),
    ...hospitalApplicationFields,
    website,
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({}).strict().optional().default({}),
});

export const organizationDecisionSchema = z.object({
  body: z.object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().max(1000).optional(),
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({ id: objectIdSchema }),
});

export const organizationParamsSchema = z.object({
  body: z.object({}).strict().optional().default({}),
  query: z.object({}).strict().optional().default({}),
  params: z.object({ id: objectIdSchema }),
});
