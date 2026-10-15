import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { User } from '../src/models/User.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('Authentification', () => {
  it('refuse une route protégée sans session', async () => {
    const response = await request(app).get('/api/patients');
    expect(response.status).toBe(401);
    expect(response.body.password).toBeUndefined();
  });

  it('refuse l’inscription d’un superadmin et ne crée aucun compte privilégié', async () => {
    const org = await createOrganization();
    const response = await request(app).post('/api/auth/register').send({
      organizationSlug: org.slug,
      firstName: 'Eve',
      lastName: 'Admin',
      email: 'eve@example.com',
      password: 'Password123!',
      role: 'SUPERADMIN',
    });

    expect(response.status).toBe(400);
    expect(await User.countDocuments({ role: 'SUPERADMIN' })).toBe(0);
    expect(await User.countDocuments({ email: 'eve@example.com' })).toBe(0);
  });

  it('inscrit un patient dans l’établissement indiqué et omet le secret', async () => {
    const org = await createOrganization();
    const response = await request(app).post('/api/auth/register').send({
      organizationSlug: org.slug,
      firstName: 'Lea',
      lastName: 'Patient',
      email: 'lea@example.com',
      password: 'Password123!',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('PATIENT');
    expect(response.body.user.organizationId).toBe(org.id);
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('Password123!');
  });

  it('renvoie le même message pour un email inconnu et un mauvais mot de passe', async () => {
    const org = await createOrganization();
    const { user, password } = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });

    const unknown = await request(app).post('/api/auth/login').send({
      email: 'inconnu@example.com',
      password: 'Password123!',
    });
    const wrong = await request(app).post('/api/auth/login').send({
      email: user.email,
      password: 'pas-le-bon',
    });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.message).toBe(wrong.body.message);
    expect(unknown.body.message).not.toContain(password);
  });

  it('n’écrit pas le mot de passe dans le journal d’audit', async () => {
    await request(app).post('/api/auth/login').send({
      email: 'inconnu@example.com',
      password: 'Secret-Unique-991',
    });

    const logs = await AuditLog.find();
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain('Secret-Unique-991');
    expect(serialized).not.toContain('passwordHash');
  });

  it('empêche un utilisateur de changer son rôle via le profil', async () => {
    const org = await createOrganization();
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });

    const response = await request(app)
      .put('/api/auth/profile')
      .set(bearer(doctor.token))
      .send({ role: 'SUPERADMIN', firstName: 'Ada' });

    expect(response.status).toBe(400);
    const fresh = await User.findById(doctor.user.id);
    expect(fresh?.role).toBe('DOCTOR');
  });

  it('invalide l’ancien jeton après déconnexion', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });

    const logout = await request(app).post('/api/auth/logout').set(bearer(admin.token));
    expect(logout.status).toBe(200);

    const again = await request(app).get('/api/auth/me').set(bearer(admin.token));
    expect(again.status).toBe(401);
  });

  it('ignore un rôle superadmin injecté dans le jeton', async () => {
    const org = await createOrganization();
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const forged = jwt.sign(
      { sub: doctor.user.id, tv: doctor.user.tokenVersion, role: 'SUPERADMIN', organizationId: 'autre' },
      process.env.JWT_SECRET as string,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const response = await request(app).get('/api/organizations').set(bearer(forged));
    expect(response.status).toBe(403);
  });
});
