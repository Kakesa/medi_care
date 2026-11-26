import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { MedicationAdministrationStatus, TreatmentCourse, TreatmentRecordFile } from "@/types/nursing";

const timeZone = "Africa/Kinshasa";

const statusLabels: Record<MedicationAdministrationStatus, string> = {
  pending: "Non confirmée",
  administered_on_time: "Effectuée à l’heure",
  administered_late: "Effectuée en retard",
  not_administered: "Non effectuée",
  patient_refused: "Refus du patient",
  suspended: "Suspendue",
  treatment_completed: "Traitement clos",
  treatment_interrupted: "Traitement interrompu",
};

const outcomeLabels = { completed: "Terminé", interrupted: "Interrompu", active: "En cours", suspended: "Suspendu" } as const;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

function calendar(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00.000Z`));
}

function moment(value?: string) {
  if (!value) return { day: "—", time: "—" };
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(date),
    time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(date),
  };
}

function patientLine(file: TreatmentRecordFile) {
  const person = file.patient;
  const sex = person.gender === "F" ? "Femme" : person.gender === "M" ? "Homme" : "Sexe non renseigné";
  const age = person.age !== undefined ? `${person.age} ans` : "âge non renseigné";
  const place = [person.ward, person.room ? `chambre ${person.room}` : ""].filter(Boolean).join(", ");
  return `${person.firstName} ${person.lastName} · ${sex} · ${age}${place ? ` · ${place}` : ""}`;
}

function tally(course: TreatmentCourse) {
  const count = (status: MedicationAdministrationStatus) => course.doses.filter((dose) => dose.status === status).length;
  return {
    onTime: count("administered_on_time"),
    late: count("administered_late"),
    missed: count("not_administered") + count("patient_refused"),
    pending: count("pending"),
  };
}

function doseRows(course: TreatmentCourse) {
  return course.doses.map((dose) => {
    const planned = moment(dose.scheduledAt);
    const given = moment(dose.administeredAt);
    return [
      planned.day,
      planned.time,
      statusLabels[dose.status],
      dose.administeredAt ? `${given.day} ${given.time}` : "—",
      dose.nurseName || "—",
      dose.note || "—",
    ];
  });
}

function courseHtml(course: TreatmentCourse) {
  const counts = tally(course);
  const rows = doseRows(course).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  return `<section>
    <h2>${escapeHtml(course.medication)}</h2>
    <p>${escapeHtml(course.dosage)} · ${escapeHtml(course.route || "voie non renseignée")} · ${escapeHtml(course.posology)}</p>
    ${course.instructions ? `<p>${escapeHtml(course.instructions)}</p>` : ""}
    <p>Prescripteur : ${escapeHtml(course.prescriberName)} · Du ${escapeHtml(calendar(course.startDate))} au ${escapeHtml(calendar(course.endDate))} · ${escapeHtml(outcomeLabels[course.outcome])}${course.closingReason ? ` · ${escapeHtml(course.closingReason)}` : ""}</p>
    <p>${counts.onTime} effectuée(s) à l’heure · ${counts.late} en retard · ${counts.missed} non effectuée(s) · ${counts.pending} non confirmée(s)</p>
    <table><thead><tr><th>Date</th><th>Heure prévue</th><th>Déroulement</th><th>Heure réelle</th><th>Infirmier</th><th>Motif</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6">Aucune prise enregistrée.</td></tr>'}</tbody></table>
  </section>`;
}

function paperHtml(file: TreatmentRecordFile) {
  const place = [file.organization.address, file.organization.city, file.organization.phone, file.organization.email].filter(Boolean).join(" · ");
  const allergies = file.patient.allergies.length ? file.patient.allergies.join(", ") : "Aucune allergie renseignée";
  const sections = file.treatments.map(courseHtml).join("") || "<p>Aucun traitement enregistré.</p>";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiche de traitement · ${escapeHtml(file.patient.lastName)}</title>
    <style>
      body{font-family:Georgia,serif;color:#111;margin:24px}
      h1{font-size:20px;text-align:center;letter-spacing:.04em;margin:12px 0}
      h2{font-size:16px;margin:22px 0 6px}
      .center{text-align:center;margin:0}
      .muted{color:#333}
      table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}
      th,td{border:1px solid #222;padding:5px;vertical-align:top}
      th{background:#e7f3f2;text-align:left}
      section{break-inside:avoid}
    </style></head><body>
    <p class="center"><strong>${escapeHtml(file.organization.name)}</strong></p>
    ${place ? `<p class="center muted">${escapeHtml(place)}</p>` : ""}
    <h1>FICHE DE TRAITEMENT</h1>
    <p>${escapeHtml(patientLine(file))}</p>
    ${file.patient.doctor ? `<p>Médecin du dossier : ${escapeHtml(file.patient.doctor)}</p>` : ""}
    <p>Allergies : ${escapeHtml(allergies)}</p>
    <p>${file.treatments.length} traitement(s)</p>
    ${sections}
    </body></html>`;
}

export function printTreatmentRecord(file: TreatmentRecordFile) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!popup) return false;
  popup.document.write(paperHtml(file));
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 300);
  return true;
}

export function downloadTreatmentRecord(file: TreatmentRecordFile) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 14;
  const width = 182;
  let y = 16;
  const next = (height: number) => {
    if (y + height <= 280) return;
    doc.addPage();
    y = 16;
  };
  const write = (text: string, bold = false) => {
    doc.setFont("times", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, width);
    next(lines.length * 5);
    doc.text(lines, left, y);
    y += lines.length * 5 + 1.5;
  };

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(file.organization.name || "HopeCare", 105, y, { align: "center" });
  y += 6;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  for (const line of [file.organization.address, file.organization.city, file.organization.phone, file.organization.email].filter(Boolean) as string[]) {
    doc.text(line, 105, y, { align: "center" });
    y += 4.5;
  }
  y += 3;
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("FICHE DE TRAITEMENT", 105, y, { align: "center" });
  y += 8;
  doc.setFontSize(11);
  write(patientLine(file));
  if (file.patient.doctor) write(`Médecin du dossier : ${file.patient.doctor}`);
  write(`Allergies : ${file.patient.allergies.length ? file.patient.allergies.join(", ") : "Aucune allergie renseignée"}`);
  write(`${file.treatments.length} traitement(s)`, true);

  const courses = file.treatments.length ? file.treatments : [];
  if (!courses.length) write("Aucun traitement enregistré.");
  for (const course of courses) {
    const counts = tally(course);
    y += 3;
    write(course.medication, true);
    write(`${course.dosage} · ${course.route || "voie non renseignée"} · ${course.posology}`);
    if (course.instructions) write(course.instructions);
    write(`Prescripteur : ${course.prescriberName} · Du ${calendar(course.startDate)} au ${calendar(course.endDate)} · ${outcomeLabels[course.outcome]}${course.closingReason ? ` · ${course.closingReason}` : ""}`);
    write(`${counts.onTime} effectuée(s) à l’heure · ${counts.late} en retard · ${counts.missed} non effectuée(s) · ${counts.pending} non confirmée(s)`);
    autoTable(doc, {
      startY: y + 1,
      margin: { left, right: 14 },
      head: [["Date", "Heure prévue", "Déroulement", "Heure réelle", "Infirmier", "Motif"]],
      body: doseRows(course).length ? doseRows(course) : [["—", "—", "Aucune prise enregistrée.", "—", "—", "—"]],
      styles: { font: "times", fontSize: 9, cellPadding: 1.6, textColor: 20 },
      headStyles: { fillColor: [15, 110, 110], textColor: 255 },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y += 6;
  }

  const slug = file.patient.lastName.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "patient";
  doc.save(`fiche-traitement-${slug}.pdf`);
}
