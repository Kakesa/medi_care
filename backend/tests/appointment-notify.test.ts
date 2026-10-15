import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Patient } from '../src/models/Patient.js';
import { sentMessages } from '../src/services/mailer.js';
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

  it('crée le compte patient et envoie l’e-mail quand le dossier n’est pas encore lié', async () => {
    sentMessages.length = 0;
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const personnel = await request(app).post('/api/personnel').set(bearer(admin.token)).send({
      firstName: 'Lea',
      lastName: 'Bernard',
      email: doctor.user.email,
      role: 'doctor',
      department: 'Médecine générale',
    });
    expect(personnel.status).toBe(201);

    const email = 'patient-rdv@example.com';
    const dossier = await Patient.create({
      organizationId: org.id,
      firstName: 'Nora',
      lastName: 'Diallo',
      email,
      status: 'outpatient',
      allergies: [],
    });

    const created = await request(app).post('/api/appointments').set(bearer(admin.token)).send({
      patientId: dossier.id,
      doctorId: personnel.body.id,
      date: '2026-11-21',
      time: '10:00',
      duration: 30,
      type: 'consultation',
    });
    expect(created.status).toBe(201);
    expect(JSON.stringify(created.body)).not.toContain('Mot de passe temporaire');

    const passwordMail = sentMessages.find((message) => message.to === email && message.text.includes('Mot de passe temporaire'));
    const appointmentMail = sentMessages.find((message) => message.to === email && message.subject === 'Nouveau rendez-vous');
    expect(passwordMail).toBeTruthy();
    expect(appointmentMail?.text).toContain('accepter');
    const password = passwordMail?.text.match(/Mot de passe temporaire : (\S+)/)?.[1];
    expect(password).toBeTruthy();

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    const changed = await request(app)
      .post('/api/auth/change-password')
      .set(bearer(login.body.token))
      .send({ currentPassword: password, newPassword: 'Nouveau-Mot-2026' });
    expect(changed.status).toBe(200);
    const notes = await request(app).get('/api/notifications').set(bearer(changed.body.token));
    expect(notes.status).toBe(200);
    expect(notes.body.data).toHaveLength(1);
    expect(notes.body.data[0].message).toContain('accepter');
  });

  it('permet au patient de demander un rendez-vous que seul son médecin confirme', async () => {
    const org = await createOrganization();
    const admin = await createUser({ role: 'HOSPITAL_ADMIN', organizationId: org.id });
    const doctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const otherDoctor = await createUser({ role: 'DOCTOR', organizationId: org.id });
    const patientUser = await createUser({ role: 'PATIENT', organizationId: org.id });
    const personnel = await request(app).post('/api/personnel').set(bearer(admin.token)).send({
      firstName: 'Ines',
      lastName: 'Morel',
      email: doctor.user.email,
      role: 'doctor',
      department: 'Médecine générale',
    });
    const otherPersonnel = await request(app).post('/api/personnel').set(bearer(admin.token)).send({
      firstName: 'Luc',
      lastName: 'Petit',
      email: otherDoctor.user.email,
      role: 'doctor',
      department: 'Médecine générale',
    });
    expect(personnel.status).toBe(201);
    expect(otherPersonnel.status).toBe(201);

    const dossier = await request(app).post('/api/patients').set(bearer(admin.token)).send({
      firstName: 'Mina',
      lastName: 'Kanza',
      dateOfBirth: '1992-03-03',
      gender: 'F',
      linkedUserId: patientUser.user.id,
    });
    const otherDossier = await request(app).post('/api/patients').set(bearer(admin.token)).send({
      firstName: 'Paul',
      lastName: 'Nsimba',
      dateOfBirth: '1988-08-08',
      gender: 'M',
    });
    expect(dossier.status).toBe(201);

    const doctors = await request(app).get('/api/personnel/doctors').set(bearer(patientUser.token));
    expect(doctors.status).toBe(200);
    expect(doctors.body.some((item: { email?: string }) => item.email)).toBe(false);

    const created = await request(app).post('/api/appointments').set(bearer(patientUser.token)).send({
      patientId: otherDossier.body.id,
      doctorId: personnel.body.id,
      date: '2026-12-02',
      time: '11:00',
      duration: 30,
      type: 'consultation',
      status: 'confirmed',
    });
    expect(created.status).toBe(201);
    expect(created.body.requestedBy).toBe('patient');
    expect(created.body.status).toBe('pending');
    expect(created.body.patientId).toBe(dossier.body.id);

    const selfAccept = await request(app)
      .patch(`/api/appointments/${created.body.id}/accept`)
      .set(bearer(patientUser.token))
      .send({});
    expect(selfAccept.status).toBe(403);

    const outsider = await request(app)
      .patch(`/api/appointments/${created.body.id}/accept`)
      .set(bearer(otherDoctor.token))
      .send({});
    expect(outsider.status).toBe(403);

    const doctorNotes = await request(app).get('/api/notifications').set(bearer(doctor.token));
    expect(doctorNotes.body.data.some((item: { message: string }) => item.message.includes('demande'))).toBe(true);

    const accepted = await request(app)
      .patch(`/api/appointments/${created.body.id}/accept`)
      .set(bearer(doctor.token))
      .send({});
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('confirmed');

    const patientNotes = await request(app).get('/api/notifications').set(bearer(patientUser.token));
    expect(patientNotes.body.data.some((item: { message: string }) => item.message.includes('a accepté'))).toBe(true);
  });
});
