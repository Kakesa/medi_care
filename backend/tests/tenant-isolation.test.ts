import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { Patient } from '../src/models/Patient.js';
import { User } from '../src/models/User.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

async function createPatient(token: string, lastName: string, primaryDoctorId?: string) {
  const response = await request(app)
    .post('/api/patients')
    .set(bearer(token))
    .send({
      firstName: 'Jean',
      lastName,
      dateOfBirth: '1980-01-02',
      gender: 'M',
      address: '12 rue Verte',
      ...(primaryDoctorId ? { primaryDoctorId } : {}),
    });
  expect(response.status).toBe(201);
  return response.body as { id: string; lastName: string; organizationId: string };
}

describe('Isolation des établissements', () => {
  it('empêche l’administrateur de l’hôpital A de lire, modifier ou archiver un patient de l’hôpital B', async () => {
    const orgA = await createOrganization('Hôpital A');
    const orgB = await createOrganization('Hôpital B');
    const adminA = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: orgA.id });
    const adminB = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: orgB.id });
    const patientB = await createPatient(adminB.token, 'Durand');

    const read = await request(app).get(`/api/patients/${patientB.id}`).set(bearer(adminA.token));
    const update = await request(app)
      .put(`/api/patients/${patientB.id}`)
      .set(bearer(adminA.token))
      .send({ lastName: 'Piraté' });
    const remove = await request(app).delete(`/api/patients/${patientB.id}`).set(bearer(adminA.token));
    const list = await request(app)
      .get('/api/patients')
      .query({ search: 'Durand', organizationId: orgB.id })
      .set(bearer(adminA.token));

    expect(read.status).toBe(404);
    expect(update.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(0);
    expect(JSON.stringify(list.body)).not.toContain('Durand');

    const stillThere = await Patient.findById(patientB.id);
    expect(stillThere?.lastName).toBe('Durand');
    expect(stillThere?.archivedAt).toBeNull();

    const denial = await AuditLog.findOne({ action: 'CROSS_TENANT_DENIED', resourceId: patientB.id });
    expect(denial).toBeTruthy();
    expect(JSON.stringify(denial)).not.toContain('bloodType');
  });

  it('limite un médecin aux dossiers qui lui sont confiés', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const otherDoctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const ownPatient = await createPatient(admin.token, 'Assigné', doctor.user.id);
    const hidden = await createPatient(admin.token, 'Autre', otherDoctor.user.id);

    const allowed = await request(app).get(`/api/patients/${ownPatient.id}`).set(bearer(doctor.token));
    const denied = await request(app).get(`/api/patients/${hidden.id}`).set(bearer(doctor.token));
    const list = await request(app).get('/api/patients').set(bearer(doctor.token));

    expect(allowed.status).toBe(200);
    expect(allowed.body.lastName).toBe('Assigné');
    expect(denied.status).toBe(403);
    expect(denied.body.message).toBe('Dossier non autorisé');
    expect(list.body.data.map((item: { lastName: string }) => item.lastName)).toEqual(['Assigné']);
  });

  it('empêche un patient de lire le dossier d’un autre patient du même hôpital', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const registered = await request(app).post('/api/auth/register').send({
      organizationSlug: org.slug,
      firstName: 'Lea',
      lastName: 'Patient',
      email: 'lea.patient@example.com',
      password: 'Password123!',
    });
    const other = await createPatient(admin.token, 'Voisin');

    const ownList = await request(app).get('/api/patients').set(bearer(registered.body.token));
    const otherRead = await request(app)
      .get(`/api/patients/${other.id}`)
      .set(bearer(registered.body.token));

    expect(ownList.status).toBe(200);
    expect(ownList.body.data).toHaveLength(1);
    expect(ownList.body.data[0].lastName).toBe('Patient');
    expect(otherRead.status).toBe(403);
  });

  it('refuse au comptable et au pharmacien l’accès aux dossiers patients', async () => {
    const org = await createOrganization();
    const accountant = await createUser({ role: 'ACCOUNTANT', organizationId: org.id });
    const pharmacist = await createUser({ role: 'PHARMACIST', organizationId: org.id });

    expect((await request(app).get('/api/patients').set(bearer(accountant.token))).status).toBe(403);
    expect((await request(app).get('/api/patients').set(bearer(pharmacist.token))).status).toBe(403);
  });

  it('interdit l’élévation de rôle, y compris vers superadmin', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });

    const doctorAttempt = await request(app)
      .patch(`/api/users/${admin.user.id}/role`)
      .set(bearer(doctor.token))
      .send({ role: 'HOSPITAL_ADMIN' });
    const superadminAttempt = await request(app)
      .patch(`/api/users/${doctor.user.id}/role`)
      .set(bearer(admin.token))
      .send({ role: 'SUPERADMIN' });
    const selfAttempt = await request(app)
      .patch(`/api/users/${admin.user.id}/role`)
      .set(bearer(admin.token))
      .send({ role: 'DOCTOR' });

    expect(doctorAttempt.status).toBe(403);
    expect(superadminAttempt.status).toBe(400);
    expect(selfAttempt.status).toBe(403);
    expect((await User.findById(doctor.user.id))?.role).toBe('DOCTOR');
    expect((await User.findById(admin.user.id))?.role).toBe('HOSPITAL_ADMIN');
  });

  it('autorise le superadmin à gérer les hôpitaux sans lire les dossiers médicaux', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const superadmin = await createUser({ role: 'SUPERADMIN' });
    await createPatient(admin.token, 'Confidentiel');

    const patients = await request(app).get('/api/patients').set(bearer(superadmin.token));
    const created = await request(app).post('/api/organizations').set(bearer(superadmin.token)).send({
      name: 'Clinique Nord',
      slug: 'clinique-nord',
      address: '5 avenue Centrale',
      phone: '0607080910',
      email: 'nord@clinique.test',
    });
    const staff = await request(app)
      .post(`/api/organizations/${created.body.id}/users`)
      .set(bearer(superadmin.token))
      .send({
        firstName: 'Nora',
        lastName: 'Admin',
        email: 'nora.admin@example.com',
        password: 'Password123!',
        role: 'HOSPITAL_ADMIN',
      });

    expect(patients.status).toBe(403);
    expect(JSON.stringify(patients.body)).not.toContain('Confidentiel');
    expect(created.status).toBe(201);
    expect(created.body.plan).toBe('unconfigured');
    expect(staff.status).toBe(201);
    expect(staff.body.organizationId).toBe(created.body.id);
    expect(staff.body.passwordHash).toBeUndefined();
  });

  it('ignore un organizationId forgé dans le jeton', async () => {
    const orgA = await createOrganization('Hôpital A');
    const orgB = await createOrganization('Hôpital B');
    const adminA = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: orgA.id });
    const adminB = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: orgB.id });
    await createPatient(adminB.token, 'SecretB');
    const forged = jwt.sign(
      { sub: adminA.user.id, tv: adminA.user.tokenVersion, organizationId: orgB.id },
      process.env.JWT_SECRET as string,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const response = await request(app).get('/api/patients').set(bearer(forged));
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
    expect(JSON.stringify(response.body)).not.toContain('SecretB');
  });

  it('coupe l’accès quand l’établissement est suspendu', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const superadmin = await createUser({ role: 'SUPERADMIN' });

    const suspension = await request(app)
      .patch(`/api/organizations/${org.id}`)
      .set(bearer(superadmin.token))
      .send({ status: 'suspended' });
    const patients = await request(app).get('/api/patients').set(bearer(admin.token));
    const login = await request(app).post('/api/auth/login').send({
      email: admin.user.email,
      password: admin.password,
    });

    expect(suspension.status).toBe(200);
    expect(patients.status).toBe(401);
    expect(login.status).toBe(403);
    expect(login.body.code).toBe('ORG_SUSPENDED');
  });
});
