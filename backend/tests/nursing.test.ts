import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { NursingCare } from '../src/models/NursingCare.js';
import { VitalSigns } from '../src/models/VitalSigns.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});

async function setupHospital() {
  const organization = await createOrganization();
  const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: organization.id });
  const nurse = await createUser({ role: 'NURSE', organizationId: organization.id });
  const doctor = await createUser({ role: 'DOCTOR', organizationId: organization.id });
  const patientResponse = await request(app).post('/api/patients').set(bearer(admin.token)).send({
    firstName: 'Nora',
    lastName: 'Patient',
    dateOfBirth: '1980-04-12',
    gender: 'F',
    status: 'hospitalized',
    room: '12A',
    primaryDoctorId: doctor.user.id,
  });
  expect(patientResponse.status).toBe(201);
  return { organization, admin, nurse, doctor, patientId: patientResponse.body.id as string };
}

describe('Module de soins infirmiers', () => {
  it('limite les écritures au rôle infirmier et conserve l’historique sans suppression', async () => {
    const hospital = await setupHospital();
    const nurseHeaders = bearer(hospital.nurse.token);
    const doctorWrite = await request(app).post('/api/nursing/vitals').set(bearer(hospital.doctor.token)).send({
      patientId: hospital.patientId,
      temperature: 37,
    });
    expect(doctorWrite.status).toBe(403);

    const created = await request(app).post('/api/nursing/care').set(nurseHeaders).send({
      patientId: hospital.patientId,
      type: 'monitoring',
      description: 'Surveillance clinique',
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(created.status).toBe(201);
    expect(created.body.nurseId).toBe(hospital.nurse.user.id);

    const completed = await request(app).patch(`/api/nursing/care/${created.body.id}/status`).set(nurseHeaders).send({
      status: 'completed',
      observations: 'Patient stable',
    });
    expect(completed.status).toBe(200);
    expect(completed.body.history).toHaveLength(2);
    expect(completed.body.performedAt).toBeTruthy();

    const correction = await request(app).post(`/api/nursing/care/${created.body.id}/corrections`).set(nurseHeaders).send({
      reason: 'Correction de saisie',
      description: 'Surveillance clinique au repos',
    });
    expect(correction.status).toBe(200);
    expect(correction.body.history).toHaveLength(3);
    expect(correction.body.history[2].reason).toBe('Correction de saisie');

    const deletion = await request(app).delete(`/api/nursing/care/${created.body.id}`).set(nurseHeaders);
    expect(deletion.status).toBe(404);
    expect(await NursingCare.countDocuments({ _id: created.body.id })).toBe(1);
    expect(await AuditLog.findOne({ action: 'NURSING_CARE_CORRECTED', resourceId: created.body.id })).toBeTruthy();
  });

  it('enregistre et trace des constantes, avec alertes de seuil sans diagnostic', async () => {
    const hospital = await setupHospital();
    const updatedThresholds = {
      systolicMin: 110, systolicMax: 180, diastolicMin: 60, diastolicMax: 120,
      temperatureMin: 35, temperatureMax: 38, heartRateMin: 50, heartRateMax: 120,
      respiratoryRateMin: 10, respiratoryRateMax: 24, oxygenSaturationMin: 92,
      glucoseMin: 70, glucoseMax: 180,
    };
    const thresholds = await request(app).patch('/api/nursing/settings').set(bearer(hospital.admin.token)).send(updatedThresholds);
    expect(thresholds.status).toBe(200);
    const response = await request(app).post('/api/nursing/vitals').set(bearer(hospital.nurse.token)).send({
      patientId: hospital.patientId,
      systolic: 100,
      diastolic: 70,
      temperature: 37,
      heartRate: 80,
      oxygenSaturation: 98,
    });
    expect(response.status).toBe(201);
    expect(response.body.alerts).toContain('Tension systolique hors seuil');
    expect(response.body.recordedBy).toBe(hospital.nurse.user.id);
    expect(JSON.stringify(response.body)).not.toContain('diagnostic');
    expect(await VitalSigns.countDocuments({ patientId: hospital.patientId })).toBe(1);
    expect(await AuditLog.findOne({ action: 'NURSING_VITALS_RECORDED', resourceId: response.body.id })).toBeTruthy();
  });

  it('reprend la dose et la voie de la prescription validée sans permettre à l’infirmier de la modifier', async () => {
    const hospital = await setupHospital();
    const prescription = await request(app).post('/api/prescriptions').set(bearer(hospital.doctor.token)).send({
      patientId: hospital.patientId,
      items: [{
        medication: 'Paracétamol',
        dosage: '500 mg',
        posology: 'Toutes les 8 heures',
        administrationRoute: 'orale',
        duration: '3 jours',
        quantityPrescribed: 9,
      }],
    });
    expect(prescription.status).toBe(201);
    const validated = await request(app).post(`/api/prescriptions/${prescription.body.id}/validate`).set(bearer(hospital.doctor.token));
    expect(validated.status).toBe(200);

    const nursePrescriptionWrite = await request(app).post('/api/prescriptions').set(bearer(hospital.nurse.token)).send({
      patientId: hospital.patientId,
      items: [{ medication: 'Autre', dosage: '1', posology: '1/jour', duration: '1 jour', quantityPrescribed: 1 }],
    });
    expect(nursePrescriptionWrite.status).toBe(403);

    const care = await request(app).post('/api/nursing/care').set(bearer(hospital.nurse.token)).send({
      patientId: hospital.patientId,
      type: 'medication',
      description: 'Administration prescrite',
      prescriptionId: prescription.body.id,
      prescriptionItemId: validated.body.items[0].id,
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(care.status).toBe(201);
    expect(care.body.medication).toBe('Paracétamol');
    expect(care.body.prescribedDose).toBe('500 mg');
    expect(care.body.administrationRoute).toBe('orale');
  });

  it('isole les patients entre établissements et autorise la lecture infirmière des patients de son établissement', async () => {
    const hospitalA = await setupHospital();
    const hospitalB = await setupHospital();
    const list = await request(app).get('/api/nursing/patients').set(bearer(hospitalA.nurse.token));
    expect(list.status).toBe(200);
    expect(list.body.data.map((patient: { id: string }) => patient.id)).toContain(hospitalA.patientId);

    const crossTenantRead = await request(app).get(`/api/nursing/patients/${hospitalB.patientId}`).set(bearer(hospitalA.nurse.token));
    const crossTenantWrite = await request(app).post('/api/nursing/vitals').set(bearer(hospitalA.nurse.token)).send({
      patientId: hospitalB.patientId,
      temperature: 37,
    });
    expect(crossTenantRead.status).toBe(404);
    expect(crossTenantWrite.status).toBe(404);
    expect(JSON.stringify(crossTenantRead.body)).not.toContain('Patient');
  });
});
