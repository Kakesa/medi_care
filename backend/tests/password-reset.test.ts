import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { sentMessages } from '../src/services/mailer.js';
import { createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('Réinitialisation du mot de passe', () => {
  it('envoie un lien utilisable une seule fois et ne révèle pas si le compte existe', async () => {
    const org = await createOrganization();
    const { user, password } = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    sentMessages.length = 0;

    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'inconnu@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toContain('Si un compte existe');
    expect(sentMessages).toHaveLength(0);

    const asked = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(asked.status).toBe(200);
    expect(asked.body.message).toBe(unknown.body.message);
    const mail = sentMessages.find((message) => message.to === user.email);
    const token = mail?.text.match(/token=([a-f0-9]+)/)?.[1];
    expect(token).toBeTruthy();

    const reset = await request(app).post('/api/auth/reset-password').send({
      token,
      newPassword: 'Nouveau-Mot-2026',
    });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ email: user.email, password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Nouveau-Mot-2026' });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.mustChangePassword).toBe(false);

    const reused = await request(app).post('/api/auth/reset-password').send({
      token,
      newPassword: 'Encore-Un-Mot-2026',
    });
    expect(reused.status).toBe(400);

    const journal = JSON.stringify(await AuditLog.find());
    expect(journal).not.toContain('Nouveau-Mot-2026');
    expect(journal).not.toContain(token);
  });
});
