import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Patient } from '../src/models/Patient.js';
import { PharmacyProduct } from '../src/models/PharmacyProduct.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('Circuit laboratoire', () => {
  it('fait circuler la demande, la validation et l\'ordonnance sans mélanger le paiement', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const receptionist = await createUser({ role: 'RECEPTIONIST', organizationId: org.id });
    const laborantin = await createUser({ role: 'LABORANTIN', organizationId: org.id });
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const pharmacist = await createUser({ role: 'PHARMACIST', organizationId: org.id });
    const patientUser = await createUser({ role: 'PATIENT', organizationId: org.id });

    const patient = await request(app).post('/api/patients').set(bearer(admin.token)).send({
      firstName: 'Lina',
      lastName: 'Mbeki',
      dateOfBirth: '1990-04-12',
      gender: 'F',
      email: patientUser.user.email,
    });
    expect(patient.status).toBe(201);

    const doctorCard = await request(app).post('/api/personnel').set(bearer(admin.token)).send({
      firstName: 'Ada',
      lastName: 'Martin',
      email: `medecin-${doctor.user.id}@example.com`,
      role: 'doctor',
      department: 'Médecine',
    });
    expect(doctorCard.status).toBe(201);

    const service = await request(app).post('/api/billing/services').set(bearer(admin.token)).send({
      code: 'NFS',
      name: 'Numération formule',
      category: 'LABORATOIRE',
      unitPrice: 30,
    });
    expect(service.status).toBe(201);

    const ordered = await request(app).post('/api/lab/orders').set(bearer(receptionist.token)).send({
      patientId: patient.body.id,
      doctorId: doctorCard.body.id,
      instructions: 'À jeun',
      items: [{ kind: 'service', catalogItemId: service.body.id, name: 'Numération formule', category: 'Hématologie' }],
    });
    expect(ordered.status).toBe(201);
    const examId = ordered.body.exams[0].id as string;
    expect(ordered.body.exams[0].billed).toBe(true);
    expect(ordered.body.invoiceId).toBeTruthy();

    const denied = await request(app).post(`/api/lab/${examId}/validate`).set(bearer(laborantin.token)).send({});
    expect(denied.status).toBe(403);

    expect((await request(app).post(`/api/lab/${examId}/start`).set(bearer(laborantin.token))).status).toBe(200);
    expect((await request(app).post(`/api/lab/${examId}/draft`).set(bearer(laborantin.token)).send({
      results: 'Hémoglobine 13 g/dL',
      technicalNotes: 'Prélèvement correct',
    })).status).toBe(200);
    expect((await request(app).post(`/api/lab/${examId}/submit`).set(bearer(laborantin.token))).status).toBe(200);

    const hidden = await request(app).get('/api/exams').set(bearer(receptionist.token));
    const pendingExam = hidden.body.data.find((row: { id: string }) => row.id === examId);
    expect(pendingExam.results).toBeUndefined();
    expect(pendingExam.official).toBe(false);

    const missingComment = await request(app).post(`/api/lab/${examId}/correction`).set(bearer(admin.token)).send({});
    expect(missingComment.status).toBe(400);
    const corrected = await request(app).post(`/api/lab/${examId}/correction`).set(bearer(admin.token)).send({ comment: 'Préciser les unités' });
    expect(corrected.status).toBe(200);
    expect(corrected.body.labStatus).toBe('CORRECTION_DEMANDEE');

    await request(app).post(`/api/lab/${examId}/draft`).set(bearer(laborantin.token)).send({ results: 'Hémoglobine 13 g/dL, leucocytes 6 G/L' });
    await request(app).post(`/api/lab/${examId}/submit`).set(bearer(laborantin.token));
    const rejected = await request(app).post(`/api/lab/${examId}/reject`).set(bearer(admin.token)).send({});
    expect(rejected.status).toBe(400);
    const validated = await request(app).post(`/api/lab/${examId}/validate`).set(bearer(admin.token)).send({ comment: 'Conforme' });
    expect(validated.status).toBe(200);
    expect(validated.body.labStatus).toBe('VALIDE');
    expect(validated.body.paymentStatus).not.toBe('paid');

    const visible = await request(app).get(`/api/lab/${examId}`).set(bearer(receptionist.token));
    expect(visible.body.official).toBe(true);
    expect(visible.body.results).toContain('leucocytes');

    await Patient.updateOne({ _id: patient.body.id }, { primaryDoctorId: doctor.user.id });
    const prescribeDenied = await request(app).post('/api/prescriptions').set(bearer(laborantin.token)).send({
      patientId: patient.body.id,
      items: [{ medication: 'Paracétamol', dosage: '500 mg', posology: '1 comprimé 3 fois par jour', duration: '3 jours', quantityPrescribed: 1 }],
    });
    expect(prescribeDenied.status).toBe(403);

    const draftRx = await request(app).post('/api/prescriptions').set(bearer(doctor.token)).send({
      patientId: patient.body.id,
      examId,
      items: [{ medication: 'Paracétamol', dosage: '500 mg', posology: '1 comprimé 3 fois par jour', duration: '3 jours', quantityPrescribed: 2 }],
    });
    expect(draftRx.status).toBe(201);
    const before = await request(app).get('/api/prescriptions').set(bearer(pharmacist.token));
    expect(before.body).toEqual([]);
    const published = await request(app).post(`/api/prescriptions/${draftRx.body.id}/validate`).set(bearer(doctor.token));
    expect(published.status).toBe(200);
    const inbox = await request(app).get('/api/prescriptions').set(bearer(pharmacist.token));
    expect(inbox.body).toHaveLength(1);
    expect(inbox.body[0].pharmacyStatus).toBe('new');

    const product = await PharmacyProduct.create({
      organizationId: org.id,
      name: 'Paracétamol 500',
      category: 'Antalgique',
      quantity: 10,
      minStock: 1,
      unit: 'boite',
      price: 4,
      currency: 'EUR',
      status: 'in_stock',
    });
    const dispensed = await request(app).post(`/api/prescriptions/${draftRx.body.id}/dispense`).set(bearer(pharmacist.token)).send({
      itemIndex: 0,
      productId: product.id,
      quantity: 1,
    });
    expect(dispensed.status).toBe(200);
    expect(dispensed.body.pharmacyStatus).toBe('partial');
    expect(dispensed.body.items[0].quantityDispensed).toBe(1);
    const stock = await PharmacyProduct.findById(product.id);
    expect(stock?.quantity).toBe(9);
  });
});
