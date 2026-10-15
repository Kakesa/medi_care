import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('Notification et acceptation d’un rendez-vous', () => {
  it('notifie le patient et le médecin, puis permet seulement au patient d’accepter', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const patientUser = await createUser({ role: 'PATIENT', organizationId: org.id });
    const outsider = await createUser({ role: 'PATIENT', organizationId: org.id });

    const personnel = await request(app).post('/api/personnel').set(bearer(admin.token)).send({
      firstName: 'Ada',
      lastName: 'Martin',
      email: doctor.user.email,
      role: 'doctor',
      department: 'Médecine générale',
    });
    expect(personnel.status).toBe(201);

    const patient = await request(app).post('/api/patients').set(bearer(admin.token)).send({
      firstName: 'Jean',
      lastName: 'Durand',
      dateOfBirth: '1980-04-12',
      gender: 'M',
      linkedUserId: patientUser.user.id,
    });
    expect(patient.status).toBe(201);

    const created = await request(app).post('/api/appointments').set(bearer(admin.token)).send({
      patientId: patient.body.id,
      doctorId: personnel.body.id,
      date: '2026-11-20',
      time: '09:30',
      duration: 30,
      type: 'consultation',
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('pending');

    const patientNotes = await request(app).get('/api/notifications').set(bearer(patientUser.token));
    const doctorNotes = await request(app).get('/api/notifications').set(bearer(doctor.token));
    expect(patientNotes.status).toBe(200);
    expect(doctorNotes.status).toBe(200);
    expect(patientNotes.body.data).toHaveLength(1);
    expect(doctorNotes.body.data).toHaveLength(1);
    expect(patientNotes.body.data[0].message).toContain('accepter');
    expect(patientNotes.body.data[0].message).not.toContain('Jean Durand est prévu');
    expect(doctorNotes.body.data[0].message).toContain('Jean Durand');
    expect(doctorNotes.body.data[0].relatedId).toBe(created.body.id);

    const foreign = await request(app).get('/api/notifications').set(bearer(outsider.token));
    expect(foreign.body.data).toEqual([]);

    const stolen = await request(app)
      .patch(`/api/notifications/${patientNotes.body.data[0].id}/read`)
      .set(bearer(doctor.token));
    expect(stolen.status).toBe(404);

    const doctorAccept = await request(app)
      .patch(`/api/appointments/${created.body.id}/accept`)
      .set(bearer(doctor.token))
      .send({});
    expect(doctorAccept.status).toBe(403);

    const outsiderAccept = await request(app)
      .patch(`/api/appointments/${created.body.id}/accept`)
      .set(bearer(outsider.token))
      .send({});
    expect(outsiderAccept.status).toBe(403);

    const accepted = await request(app)
      .patch(`/api/appointments/${created.body.id}/accept`)
      .set(bearer(patientUser.token))
      .send({});
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('confirmed');

    const again = await request(app)
      .patch(`/api/appointments/${created.body.id}/accept`)
      .set(bearer(patientUser.token))
      .send({});
    expect(again.status).toBe(409);

    const doctorAfter = await request(app).get('/api/notifications').set(bearer(doctor.token));
    expect(doctorAfter.body.data.some((item: { message: string }) => item.message.includes('a accepté'))).toBe(true);
  });
});
