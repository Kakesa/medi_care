import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('Lits et services', () => {
  it('refuse une lecture sans jeton', async () => {
    const response = await request(app).get('/api/beds');
    expect(response.status).toBe(401);
  });

  it('crée, modifie et supprime un lit dans son hôpital', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const receptionist = await createUser({ role: 'RECEPTIONIST', organizationId: org.id });

    const ward = await request(app).post('/api/wards').set(bearer(admin.token)).send({
      name: 'Cardiologie',
      floor: 2,
      department: 'Cardiologie',
    });
    expect(ward.status).toBe(201);
    expect(ward.body.totalBeds).toBe(0);

    const created = await request(app).post('/api/beds').set(bearer(receptionist.token)).send({
      number: 'A-101',
      wardId: ward.body.id,
      type: 'standard',
    });
    expect(created.status).toBe(201);
    expect(created.body.wardName).toBe('Cardiologie');
    expect(created.body.status).toBe('available');

    const updated = await request(app).put(`/api/beds/${created.body.id}`).set(bearer(admin.token)).send({
      status: 'reserved',
      notes: 'Admission prévue',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('reserved');

    const removed = await request(app).delete(`/api/beds/${created.body.id}`).set(bearer(admin.token));
    expect(removed.status).toBe(200);

    const list = await request(app).get('/api/beds').set(bearer(admin.token));
    expect(list.body.total).toBe(0);
  });

  it('isole les lits entre deux hôpitaux', async () => {
    const orgA = await createOrganization('Hôpital A');
    const orgB = await createOrganization('Hôpital B');
    const adminA = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: orgA.id });
    const adminB = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: orgB.id });

    const ward = await request(app).post('/api/wards').set(bearer(adminB.token)).send({
      name: 'Réanimation',
      floor: 1,
      department: 'Réanimation',
    });
    const bed = await request(app).post('/api/beds').set(bearer(adminB.token)).send({
      number: 'SI-01',
      wardId: ward.body.id,
      type: 'intensive_care',
    });
    expect(bed.status).toBe(201);

    const denied = await request(app).get(`/api/beds/${bed.body.id}`).set(bearer(adminA.token));
    expect(denied.status).toBe(404);
    expect(JSON.stringify(denied.body)).not.toContain('SI-01');

    const audit = await AuditLog.findOne({ action: 'CROSS_TENANT_DENIED', resourceId: bed.body.id });
    expect(audit).toBeTruthy();
  });

  it('attribue un patient puis refuse la suppression du lit occupé', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const patient = await request(app).post('/api/patients').set(bearer(admin.token)).send({
      firstName: 'Jean',
      lastName: 'Martin',
      dateOfBirth: '1975-03-02',
      gender: 'M',
    });
    const ward = await request(app).post('/api/wards').set(bearer(admin.token)).send({
      name: 'Chirurgie',
      floor: 3,
      department: 'Chirurgie',
    });
    const bed = await request(app).post('/api/beds').set(bearer(admin.token)).send({
      number: 'C-12',
      wardId: ward.body.id,
      type: 'standard',
    });

    const assigned = await request(app).put(`/api/beds/${bed.body.id}/assign`).set(bearer(admin.token)).send({
      patientId: patient.body.id,
    });
    expect(assigned.status).toBe(200);
    expect(assigned.body.patientName).toBe('Jean Martin');
    expect(assigned.body.status).toBe('occupied');

    const blocked = await request(app).delete(`/api/beds/${bed.body.id}`).set(bearer(admin.token));
    expect(blocked.status).toBe(409);

    const released = await request(app).put(`/api/beds/${bed.body.id}/release`).set(bearer(admin.token)).send({});
    expect(released.status).toBe(200);
    expect(released.body.status).toBe('available');
    expect(released.body.patientName).toBeUndefined();
  });
});
