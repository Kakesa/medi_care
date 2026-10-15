import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { sentMessages } from '../src/services/mailer.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('Compte patient avec mot de passe temporaire', () => {
  it('envoie le mot de passe par e-mail et bloque l’application jusqu’au changement', async () => {
    sentMessages.length = 0;
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const email = `patient-${org.id}@example.com`;

    const created = await request(app).post('/api/users').set(bearer(admin.token)).send({
      firstName: 'Awa',
      lastName: 'Kabila',
      email,
      role: 'PATIENT',
    });
    expect(created.status).toBe(201);
    expect(created.body.mustChangePassword).toBe(true);
    expect(JSON.stringify(created.body)).not.toMatch(/Mot de passe temporaire/);

    const mail = sentMessages.find((message) => message.to === email);
    expect(mail).toBeTruthy();
    const password = mail?.text.match(/Mot de passe temporaire : (\S+)/)?.[1];
    expect(password).toBeTruthy();
    expect(JSON.stringify(await AuditLog.find())).not.toContain(password);

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);

    const blocked = await request(app).get('/api/appointments').set(bearer(login.body.token));
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const profile = await request(app).get('/api/auth/me').set(bearer(login.body.token));
    expect(profile.status).toBe(200);

    const changed = await request(app).post('/api/auth/change-password').set(bearer(login.body.token)).send({
      currentPassword: password,
      newPassword: 'Nouveau-Mot-2026',
    });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);

    const allowed = await request(app).get('/api/appointments').set(bearer(changed.body.token));
    expect(allowed.status).toBe(200);
  });

  it('envoie un mot de passe temporaire au médecin créé et l’oblige à le changer', async () => {
    sentMessages.length = 0;
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const email = `medecin-${org.id}@example.com`;

    const created = await request(app).post('/api/personnel').set(bearer(admin.token)).send({
      firstName: 'Amina',
      lastName: 'Diallo',
      email,
      role: 'doctor',
      department: 'Cardiologie',
    });
    expect(created.status).toBe(201);
    expect(created.body.welcomeEmailSent).toBe(true);
    expect(JSON.stringify(created.body)).not.toMatch(/Mot de passe temporaire/);

    const mail = sentMessages.find((message) => message.to === email);
    const password = mail?.text.match(/Mot de passe temporaire : (\S+)/)?.[1];
    expect(password).toBeTruthy();
    expect(JSON.stringify(await AuditLog.find())).not.toContain(password);

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.body.user.mustChangePassword).toBe(true);
    expect(login.body.user.role).toBe('DOCTOR');
    const blocked = await request(app).get('/api/patients').set(bearer(login.body.token));
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});
