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

async function seedHospital() {
  const org = await createOrganization();
  const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
  const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id, email: `medecin-${org.id}@example.com` });
  const otherDoctor = await createUser({ role: 'DOCTOR', organizationId: org.id, email: `autre-${org.id}@example.com` });

  const personnel = await request(app).post('/api/personnel').set(bearer(admin.token)).send({
    firstName: 'Ada',
    lastName: 'Martin',
    email: doctor.user.email,
    role: 'doctor',
    department: 'Médecine générale',
  });
  expect(personnel.status).toBe(201);

  const otherPersonnel = await request(app).post('/api/personnel').set(bearer(admin.token)).send({
    firstName: 'Luc',
    lastName: 'Bernard',
    email: otherDoctor.user.email,
    role: 'doctor',
    department: 'Cardiologie',
  });
  expect(otherPersonnel.status).toBe(201);

  const patient = await request(app).post('/api/patients').set(bearer(admin.token)).send({
    firstName: 'Jean',
    lastName: 'Durand',
    dateOfBirth: '1980-04-12',
    gender: 'M',
    primaryDoctorId: doctor.user.id,
  });
  expect(patient.status).toBe(201);

  return { org, admin, doctor, otherDoctor, personnelId: personnel.body.id as string, patientId: patient.body.id as string };
}

describe('Isolation du dossier clinique', () => {
  it('refuse une requête sans jeton', async () => {
    const response = await request(app).get('/api/personnel');
    expect(response.status).toBe(401);
  });

  it('empêche l’hôpital A de lire le personnel, un rendez-vous, une consultation, un examen, un produit ou une facture de l’hôpital B', async () => {
    const hospitalA = await seedHospital();
    const hospitalB = await seedHospital();

    const appointment = await request(app).post('/api/appointments').set(bearer(hospitalB.admin.token)).send({
      patientId: hospitalB.patientId,
      doctorId: hospitalB.personnelId,
      date: '2026-11-02',
      time: '09:00',
      duration: 30,
      type: 'consultation',
    });
    expect(appointment.status).toBe(201);

    const consultation = await request(app).post('/api/consultations').set(bearer(hospitalB.doctor.token)).send({
      patientId: hospitalB.patientId,
      doctorId: hospitalB.personnelId,
      diagnosis: 'Grippe',
      symptoms: ['fièvre'],
      treatment: 'Repos',
    });
    expect(consultation.status).toBe(201);

    const exam = await request(app).post('/api/exams').set(bearer(hospitalB.admin.token)).send({
      patientId: hospitalB.patientId,
      doctorId: hospitalB.personnelId,
      type: 'laboratory',
      category: 'Sang',
      name: 'NFS',
      date: '2026-11-03',
    });
    expect(exam.status).toBe(201);

    const product = await request(app).post('/api/pharmacy/products').set(bearer(hospitalB.admin.token)).send({
      name: 'Paracétamol',
      category: 'Antalgique',
      quantity: 10,
      minStock: 5,
      unit: 'boîtes',
      price: 2.5,
      supplier: 'Labo',
    });
    expect(product.status).toBe(201);

    const invoice = await request(app).post('/api/billing/invoices').set(bearer(hospitalB.admin.token)).send({
      patientId: hospitalB.patientId,
      items: [{ description: 'Consultation', quantity: 1, unitPrice: 25, type: 'consultation' }],
    });
    expect(invoice.status).toBe(201);

    const checks = [
      request(app).get(`/api/personnel/${hospitalB.personnelId}`).set(bearer(hospitalA.admin.token)),
      request(app).get(`/api/appointments/${appointment.body.id}`).set(bearer(hospitalA.admin.token)),
      request(app).get(`/api/consultations/${consultation.body.id}`).set(bearer(hospitalA.admin.token)),
      request(app).get(`/api/exams/${exam.body.id}`).set(bearer(hospitalA.admin.token)),
      request(app).get(`/api/pharmacy/products/${product.body.id}`).set(bearer(hospitalA.admin.token)),
      request(app).get(`/api/billing/invoices/${invoice.body.id}`).set(bearer(hospitalA.admin.token)),
    ];
    const responses = await Promise.all(checks);
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(JSON.stringify(response.body)).not.toContain('Durand');
      expect(JSON.stringify(response.body)).not.toContain('Grippe');
    }

    const denial = await AuditLog.findOne({ action: 'CROSS_TENANT_DENIED', resourceId: consultation.body.id });
    expect(denial).toBeTruthy();
  });

  it('empêche un médecin de lire la consultation d’un confrère', async () => {
    const hospital = await seedHospital();
    const created = await request(app).post('/api/consultations').set(bearer(hospital.doctor.token)).send({
      patientId: hospital.patientId,
      doctorId: hospital.personnelId,
      diagnosis: 'Otite',
      symptoms: ['douleur'],
      treatment: 'Antalgique',
    });
    expect(created.status).toBe(201);

    const denied = await request(app).get(`/api/consultations/${created.body.id}`).set(bearer(hospital.otherDoctor.token));
    expect(denied.status).toBe(403);
    expect(JSON.stringify(denied.body)).not.toContain('Otite');
  });

  it('interdit au pharmacien de lire les factures', async () => {
    const org = await createOrganization();
    const pharmacist = await createUser({ role: 'PHARMACIST', organizationId: org.id });
    const response = await request(app).get('/api/billing/invoices').set(bearer(pharmacist.token));
    expect(response.status).toBe(403);
  });
});
