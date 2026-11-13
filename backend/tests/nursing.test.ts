import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { BedStay } from '../src/models/BedStay.js';
import { MedicationAdministration } from '../src/models/MedicationAdministration.js';
import { NursingCare } from '../src/models/NursingCare.js';
import { VitalSigns } from '../src/models/VitalSigns.js';
import { bearer, createOrganization, createUser } from './helpers.js';

let app: Express;

function kinshasaDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offsetDays));
  return date.toISOString().slice(0, 10);
}

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
  it('retourne le séjour actif et calcule les jours depuis l’admission', async () => {
    const hospital = await setupHospital();
    const today = new Date();
    const admissionDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 5));
    await BedStay.create({
      organizationId: hospital.organization.id,
      bedId: new (await import('mongoose')).default.Types.ObjectId(),
      bedNumber: '12A',
      wardName: 'Médecine',
      patientId: hospital.patientId,
      patientName: 'Nora Patient',
      admissionDate,
      status: 'active',
    });

    const response = await request(app).get(`/api/nursing/patients/${hospital.patientId}`).set(bearer(hospital.nurse.token));

    expect(response.status).toBe(200);
    expect(response.body.hospitalization).toMatchObject({
      status: 'active',
      durationDays: 5,
      ward: 'Médecine',
      room: '12A',
    });
    expect(response.body.hospitalization.admittedAt).toBe(admissionDate.toISOString());
  });

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
    expect(thresholds.body.systolicMin).toBe(110);
    const response = await request(app).post('/api/nursing/vitals').set(bearer(hospital.nurse.token)).send({
      patientId: hospital.patientId,
      systolic: 100,
      diastolic: 70,
      temperature: 37,
      heartRate: 80,
      oxygenSaturation: 98,
    });
    expect(response.status).toBe(201);
    expect(response.body.systolic).toBe(100);
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

  it('génère la feuille quotidienne et trace confirmations, prises manquées et corrections', async () => {
    const hospital = await setupHospital();
    const prescription = await request(app).post('/api/prescriptions').set(bearer(hospital.doctor.token)).send({
      patientId: hospital.patientId,
      items: [{
        medication: 'Paracétamol', dosage: '1 comprimé', posology: '3 fois par jour',
        administrationRoute: 'orale', duration: '3 jours', quantityPrescribed: 9,
        treatmentStartDate: kinshasaDate(-1), treatmentEndDate: kinshasaDate(1),
        administrationTimes: ['00:01', '08:00', '23:59'],
      }],
    });
    expect(prescription.status).toBe(201);
    const validated = await request(app).post(`/api/prescriptions/${prescription.body.id}/validate`).set(bearer(hospital.doctor.token));
    expect(validated.status).toBe(200);

    const sheet = await request(app).get('/api/nursing/administrations')
      .query({ patientId: hospital.patientId, date: kinshasaDate() })
      .set(bearer(hospital.nurse.token));
    expect(sheet.status, JSON.stringify(sheet.body)).toBe(200);
    expect(sheet.body.timeZone).toBe('Africa/Kinshasa');
    expect(sheet.body.lateWindowMinutes).toBe(60);
    expect(sheet.body.doses).toHaveLength(3);
    expect(sheet.body.doses[0]).toMatchObject({ medication: 'Paracétamol', prescribedDose: '1 comprimé', status: 'not_administered' });
    expect(sheet.body.doses[2].status).toBe('pending');
    expect(await MedicationAdministration.countDocuments({ patientId: hospital.patientId })).toBe(3);
    const repeatedSheet = await request(app).get('/api/nursing/administrations')
      .query({ patientId: hospital.patientId, date: kinshasaDate() })
      .set(bearer(hospital.nurse.token));
    expect(repeatedSheet.body.doses.map((dose: { id: string }) => dose.id)).toEqual(sheet.body.doses.map((dose: { id: string }) => dose.id));
    expect(await MedicationAdministration.countDocuments({ patientId: hospital.patientId })).toBe(3);

    const lateDose = sheet.body.doses[0];
    const lateWithoutReason = await request(app).post(`/api/nursing/administrations/${lateDose.id}/confirm`)
      .set(bearer(hospital.nurse.token)).send({});
    expect(lateWithoutReason.status).toBe(400);
    const lateConfirmation = await request(app).post(`/api/nursing/administrations/${lateDose.id}/confirm`)
      .set(bearer(hospital.nurse.token)).send({ reason: 'Patient encore au bloc' });
    expect(lateConfirmation.status).toBe(200);
    expect(lateConfirmation.body.status).toBe('administered_late');
    expect(lateConfirmation.body.observations).toBe('Patient encore au bloc');
    expect(lateConfirmation.body.administeredBy).toBe(hospital.nurse.user.id);
    expect(lateConfirmation.body.administeredAt).toBeTruthy();

    const missedDose = sheet.body.doses[1];
    const missed = await request(app).post(`/api/nursing/administrations/${missedDose.id}/not-administered`)
      .set(bearer(hospital.nurse.token)).send({ reasonType: 'patient_refused', reason: 'Refus confirmé par le patient' });
    expect(missed.status).toBe(200);
    expect(missed.body.status).toBe('patient_refused');
    expect(missed.body.notDoneReason).toBe('Refus confirmé par le patient');

    const correction = await request(app).post(`/api/nursing/administrations/${missedDose.id}/corrections`)
      .set(bearer(hospital.nurse.token)).send({ reason: 'Précision au dossier', observations: 'Médecin informé' });
    expect(correction.status).toBe(200);
    expect(correction.body.history).toHaveLength(2);
    expect(correction.body.history[1].reason).toBe('Précision au dossier');

    const forbiddenWrite = await request(app).post(`/api/nursing/administrations/${sheet.body.doses[2].id}/confirm`)
      .set(bearer(hospital.doctor.token)).send({});
    expect(forbiddenWrite.status).toBe(403);
    const earlyMissed = await request(app).post(`/api/nursing/administrations/${sheet.body.doses[2].id}/not-administered`)
      .set(bearer(hospital.nurse.token)).send({ reasonType: 'other', reason: 'Tentative prématurée' });
    expect(earlyMissed.status).toBe(409);
    const missingReason = await request(app).post(`/api/nursing/administrations/${sheet.body.doses[2].id}/not-administered`)
      .set(bearer(hospital.nurse.token)).send({ reasonType: 'other', reason: '' });
    expect(missingReason.status).toBe(400);
  });

  it('suspend et reprend un traitement côté médecin sans marquer les prises comme manquées', async () => {
    const hospital = await setupHospital();
    const prescription = await request(app).post('/api/prescriptions').set(bearer(hospital.doctor.token)).send({
      patientId: hospital.patientId,
      items: [{
        medication: 'Antibiotique', dosage: '1 comprimé', posology: '2 fois par jour',
        administrationRoute: 'orale', duration: '3 jours', quantityPrescribed: 6,
        treatmentStartDate: kinshasaDate(-1), treatmentEndDate: kinshasaDate(1),
        administrationTimes: ['08:00', '23:59'],
      }],
    });
    const prescriptionId = prescription.body.id as string;
    const itemId = prescription.body.items[0].id as string;
    await request(app).post(`/api/prescriptions/${prescriptionId}/validate`).set(bearer(hospital.doctor.token));

    const firstSheet = await request(app).get('/api/nursing/administrations')
      .query({ patientId: hospital.patientId, date: kinshasaDate() })
      .set(bearer(hospital.nurse.token));
    expect(firstSheet.status).toBe(200);
    const futureDose = firstSheet.body.doses.find((dose: { scheduledAt: string }) => new Date(dose.scheduledAt) > new Date());
    expect(futureDose).toBeTruthy();

    const suspended = await request(app).patch(`/api/prescriptions/${prescriptionId}/items/${itemId}/status`)
      .set(bearer(hospital.doctor.token)).send({ status: 'suspended', reason: 'Surveillance médicale' });
    expect(suspended.status).toBe(200);
    expect(suspended.body.items[0].treatmentStatus).toBe('suspended');

    const nurseCannotSuspend = await request(app).patch(`/api/prescriptions/${prescriptionId}/items/${itemId}/status`)
      .set(bearer(hospital.nurse.token)).send({ status: 'active', reason: 'Reprise demandée' });
    expect(nurseCannotSuspend.status).toBe(403);

    const suspendedSheet = await request(app).get('/api/nursing/administrations')
      .query({ patientId: hospital.patientId, date: kinshasaDate() })
      .set(bearer(hospital.nurse.token));
    const suspendedDose = suspendedSheet.body.doses.find((dose: { id: string }) => dose.id === futureDose.id);
    expect(suspendedDose.status).toBe('suspended');
    const cannotMarkSuspendedMissed = await request(app).post(`/api/nursing/administrations/${futureDose.id}/not-administered`)
      .set(bearer(hospital.nurse.token)).send({ reasonType: 'other', reason: 'Dose suspendue' });
    expect(cannotMarkSuspendedMissed.status).toBe(409);

    const resumed = await request(app).patch(`/api/prescriptions/${prescriptionId}/items/${itemId}/status`)
      .set(bearer(hospital.doctor.token)).send({ status: 'active', reason: 'Reprise autorisée' });
    expect(resumed.status).toBe(200);
    const resumedSheet = await request(app).get('/api/nursing/administrations')
      .query({ patientId: hospital.patientId, date: kinshasaDate() })
      .set(bearer(hospital.nurse.token));
    expect(resumedSheet.body.doses.find((dose: { id: string }) => dose.id === futureDose.id).status).toBe('pending');
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
