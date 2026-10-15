import { z } from 'zod';

const passwordSchema = z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').max(128);

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email invalide').max(160),
    password: z.string().min(1, 'Mot de passe requis').max(128),
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({}).strict().optional().default({}),
});

export const registerSchema = z.object({
  body: z.object({
    organizationSlug: z.string().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Identifiant d’établissement invalide'),
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    email: z.string().email('Email invalide').max(160),
    phone: z.string().max(30).optional(),
    password: passwordSchema,
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({}).strict().optional().default({}),
});

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    email: z.string().email('Email invalide').max(160).optional(),
    phone: z.string().max(30).optional(),
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({}).strict().optional().default({}),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({}).strict().optional().default({}),
});
