import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildLoginRateLimiter } from '../src/middlewares/rateLimit.middleware.js';

describe('Limitation des tentatives', () => {
  it('bloque les connexions au-delà du seuil configuré', async () => {
    const app = express();
    app.use(express.json());
    app.post('/api/auth/login', buildLoginRateLimiter(2), (_req, res) => {
      res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    });

    await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'x' });
    await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'x' });
    const blocked = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'x' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(JSON.stringify(blocked.body)).not.toContain('password');
  });
});
