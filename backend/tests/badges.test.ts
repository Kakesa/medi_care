import mongoose from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Exam } from '../src/models/Exam.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('Badges de travail', () => {
  it('compte un examen de laboratoire pour le bon rôle et le bon hôpital', async () => {
    const org = await createOrganization();
    const other = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const laborantin = await createUser({ role: 'LABORANTIN', organizationId: org.id });
    const receptionist = await createUser({ role: 'RECEPTIONIST', organizationId: org.id });
    const outsider = await createUser({ role: 'LABORANTIN', organizationId: other.id });
    const superadmin = await createUser({ role: 'SUPERADMIN' });

    await Exam.create({
      organizationId: org.id,
      patientId: new mongoose.Types.ObjectId(),
      patientName: 'Lina Mbeki',
      doctorId: new mongoose.Types.ObjectId(),
      doctorName: 'Dr Martin',
      type: 'laboratory',
      name: 'Glycémie',
      category: 'Biochimie',
      date: new Date(),
      status: 'pending',
      labStatus: 'EN_ATTENTE',
    });

    const lab = await request(app).get('/api/badges').set(bearer(laborantin.token));
    expect(lab.status).toBe(200);
    expect(lab.body.counts['/dashboard/laboratoire']).toBe(1);
    expect(lab.body.counts['/dashboard/supervision-lab']).toBeUndefined();

    const waiting = await request(app).get('/api/badges').set(bearer(admin.token));
    expect(waiting.status).toBe(200);
    expect(waiting.body.counts['/dashboard/supervision-lab']).toBeUndefined();
    expect(waiting.body.counts['/dashboard/examinations']).toBe(1);

    const desk = await request(app).get('/api/badges').set(bearer(receptionist.token));
    expect(desk.body.counts['/dashboard/demandes-lab']).toBe(1);

    const foreign = await request(app).get('/api/badges').set(bearer(outsider.token));
    expect(foreign.body.counts['/dashboard/laboratoire']).toBeUndefined();

    const global = await request(app).get('/api/badges').set(bearer(superadmin.token));
    expect(global.status).toBe(403);
  });

  it('réserve la supervision aux examens déjà soumis', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const laborantin = await createUser({ role: 'LABORANTIN', organizationId: org.id });

    await Exam.create({
      organizationId: org.id,
      patientId: new mongoose.Types.ObjectId(),
      patientName: 'Lina Mbeki',
      doctorId: new mongoose.Types.ObjectId(),
      doctorName: 'Dr Martin',
      type: 'laboratory',
      name: 'Cholestérol',
      category: 'Biochimie',
      date: new Date(),
      status: 'in_progress',
      labStatus: 'EN_ATTENTE_VALIDATION',
    });

    const review = await request(app).get('/api/badges').set(bearer(admin.token));
    expect(review.body.counts['/dashboard/supervision-lab']).toBe(1);

    const bench = await request(app).get('/api/badges').set(bearer(laborantin.token));
    expect(bench.body.counts['/dashboard/laboratoire']).toBeUndefined();
  });

  it('retire le badge du résultat dès qu\'il a été consulté', async () => {
    const org = await createOrganization();
    const other = await createOrganization();
    const receptionist = await createUser({ role: 'RECEPTIONIST', organizationId: org.id });
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const outsider = await createUser({ role: 'RECEPTIONIST', organizationId: other.id });
    const ready = await Exam.create({
      organizationId: org.id,
      patientId: new mongoose.Types.ObjectId(),
      patientName: 'Lina Mbeki',
      doctorId: new mongoose.Types.ObjectId(),
      doctorName: 'Dr Martin',
      type: 'laboratory',
      name: 'Glycémie',
      category: 'Biochimie',
      date: new Date(),
      status: 'completed',
      labStatus: 'VALIDE',
      results: '5,6 mmol/L',
    });
    const waiting = await Exam.create({
      organizationId: org.id,
      patientId: new mongoose.Types.ObjectId(),
      patientName: 'Lina Mbeki',
      doctorId: new mongoose.Types.ObjectId(),
      doctorName: 'Dr Martin',
      type: 'laboratory',
      name: 'Cholestérol',
      category: 'Biochimie',
      date: new Date(),
      status: 'in_progress',
      labStatus: 'EN_ATTENTE_VALIDATION',
      draftResults: '2,1 g/L',
    });

    const before = await request(app).get('/api/badges').set(bearer(receptionist.token));
    expect(before.body.counts['/dashboard/demandes-lab']).toBe(2);
    expect(before.body.counts['/dashboard/examinations']).toBe(2);

    const seen = await request(app).post('/api/badges/seen').set(bearer(receptionist.token)).send({ ids: [ready.id] });
    expect(seen.status).toBe(200);
    const after = await request(app).get('/api/badges').set(bearer(receptionist.token));
    expect(after.body.counts['/dashboard/demandes-lab']).toBe(1);
    expect(after.body.counts['/dashboard/examinations']).toBe(1);

    const ignored = await request(app).post('/api/badges/seen').set(bearer(outsider.token)).send({ ids: [waiting.id] });
    expect(ignored.status).toBe(200);
    const review = await request(app).get('/api/badges').set(bearer(admin.token));
    expect(review.body.counts['/dashboard/supervision-lab']).toBe(1);
    const opened = await request(app).post('/api/badges/seen').set(bearer(admin.token)).send({ ids: [waiting.id] });
    expect(opened.status).toBe(200);
    const cleared = await request(app).get('/api/badges').set(bearer(admin.token));
    expect(cleared.body.counts['/dashboard/supervision-lab']).toBeUndefined();
  });
});
