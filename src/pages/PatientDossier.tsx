import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiMessage } from "@/lib/apiError";
import { patientService, type DossierConsultation, type DossierExam, type PatientDossier } from "@/services/patientService";

const timeZone = "Africa/Kinshasa";

const labStatusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  BROUILLON: "Brouillon",
  EN_ATTENTE_VALIDATION: "À valider",
  CORRECTION_DEMANDEE: "Correction demandée",
  VALIDE: "Validé",
  REJETE: "Rejeté",
  ANNULE: "Annulé",
};

const examStatusLabels: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
};

const stayStatusLabels: Record<string, string> = {
  active: "En cours",
  completed: "Terminée",
};

const patientStatusLabels: Record<string, string> = {
  outpatient: "Ambulatoire",
  hospitalized: "Hospitalisé",
  discharged: "Sorti",
};

function formatDay(value?: string) {
  if (!value) return "Date non renseignée";
  const iso = value.slice(0, 10);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00.000Z`));
}

function formatDateTime(value?: string) {
  if (!value) return "Date non renseignée";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone, hourCycle: "h23",
  }).format(new Date(value));
}

function consultationWhen(row: DossierConsultation) {
  const day = formatDay(row.date || row.recordedAt);
  if (!row.recordedAt) return day;
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone, hourCycle: "h23",
  }).format(new Date(row.recordedAt));
  return `${day} · ${time}`;
}

function ageOf(dateOfBirth?: string) {
  if (!dateOfBirth) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age >= 0 ? age : undefined;
}

function textOrEmpty(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{value || "Non renseigné"}</p>
    </div>
  );
}

function ExamLines({ exams }: { exams: DossierExam[] }) {
  if (!exams.length) return null;
  return (
    <div className="space-y-2">
      {exams.map((exam) => (
        <div key={exam.id} className="rounded-lg border px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{exam.name}</p>
            <Badge variant="outline">{exam.labStatus ? labStatusLabels[exam.labStatus] ?? exam.labStatus : examStatusLabels[exam.status ?? ""] ?? exam.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{formatDay(exam.date)}{exam.doctorName ? ` · ${exam.doctorName}` : ""}</p>
          <p className="mt-1 whitespace-pre-wrap">{exam.results || "Résultat non disponible"}</p>
        </div>
      ))}
    </div>
  );
}

function ConsultationDetail({ row }: { row: DossierConsultation }) {
  const observations = [row.symptoms.join(", "), textOrEmpty(row.histoireMaladie), textOrEmpty(row.comportementAnamnese), textOrEmpty(row.examenPhysique)].filter(Boolean).join("\n\n");
  const diagnosis = textOrEmpty(row.diagnosis) || textOrEmpty(row.conclusion);
  const treatment = [textOrEmpty(row.treatment), textOrEmpty(row.prescription)].filter(Boolean).join("\n\n");
  const recommendations = [
    textOrEmpty(row.diagnosis) ? textOrEmpty(row.conclusion) : undefined,
    textOrEmpty(row.notes),
    row.followUpDate ? `Suivi prévu le ${formatDay(row.followUpDate)}` : undefined,
  ].filter(Boolean).join("\n\n");
  const requested = textOrEmpty(row.requestedExams);

  return (
    <div className="space-y-4 pb-4">
      <Field label="Date et heure" value={consultationWhen(row)} />
      <Field label="Médecin" value={row.doctorName} />
      <Field label="Motif de consultation" value={textOrEmpty(row.motif)} />
      <Field label="Symptômes et observations" value={observations || undefined} />
      <Field label="Diagnostic posé" value={diagnosis} />
      <Field label="Traitement et prescriptions" value={treatment || undefined} />
      <div className="space-y-2">
        <Field label="Examens demandés" value={requested} />
        <ExamLines exams={row.exams} />
        {requested && row.exams.length === 0 && <p className="text-sm text-muted-foreground">Résultat non disponible.</p>}
      </div>
      <Field label="Recommandations du médecin" value={recommendations || undefined} />
    </div>
  );
}

export default function PatientDossier() {
  const { patientId = "" } = useParams();
  const navigate = useNavigate();
  const [dossier, setDossier] = useState<PatientDossier | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    patientService.getDossier(patientId)
      .then((result) => { if (active) setDossier(result); })
      .catch((reason) => { if (active) setError(apiMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [patientId]);

  const patient = dossier?.patient;
  const age = ageOf(patient?.dateOfBirth);
  const sex = patient?.gender === "F" ? "Femme" : patient?.gender === "M" ? "Homme" : "Non renseigné";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button type="button" variant="ghost" className="-ml-2 h-9 px-2" onClick={() => navigate("/dashboard/patients")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Patients
      </Button>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-primary md:text-sm md:normal-case md:tracking-normal">Dossier médical</p>
        <h1 className="text-lg font-bold leading-tight md:text-3xl">{patient ? `${patient.lastName} ${patient.firstName}` : "Dossier patient"}</h1>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Chargement du dossier…</p>}
      {error && <p className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">{error}</p>}

      {patient && dossier && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fiche du patient</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Nom et postnom" value={patient.lastName} />
              <Field label="Prénom" value={patient.firstName} />
              <Field label="Sexe" value={sex} />
              <Field label="Âge" value={age !== undefined ? `${age} ans` : undefined} />
              <Field label="Date de naissance" value={patient.dateOfBirth ? formatDay(patient.dateOfBirth) : undefined} />
              <Field label="Groupe sanguin" value={patient.bloodType} />
              <Field label="Adresse" value={patient.address} />
              <Field label="Téléphone" value={patient.phone} />
              <Field label="Email" value={patient.email} />
              <Field label="Personne à contacter" value={undefined} />
              <Field label="Statut" value={patientStatusLabels[patient.status] ?? patient.status} />
              <Field label="Médecin traitant" value={patient.doctorName} />
              <Field label="Chambre" value={patient.room} />
              <Field label="Température" value={patient.temperature != null ? `${patient.temperature.toLocaleString("fr-FR")} °C` : undefined} />
              <Field label="Tension" value={patient.tension} />
              <Field label="Saturation" value={patient.saturation != null ? `${patient.saturation} %` : undefined} />
              <Field label="Inscrit le" value={patient.createdAt ? formatDateTime(patient.createdAt) : undefined} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Historique des consultations</CardTitle>
            </CardHeader>
            <CardContent>
              {dossier.consultations.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">Aucune consultation antérieure enregistrée pour ce patient.</p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {dossier.consultations.map((row) => (
                    <AccordionItem key={row.id} value={row.id}>
                      <AccordionTrigger className="gap-3 text-left hover:no-underline">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{consultationWhen(row)}</span>
                          <span className="block truncate text-xs font-normal text-muted-foreground">{row.doctorName}{row.motif ? ` · ${row.motif}` : ""}</span>
                        </span>
                        <Badge variant="outline" className="shrink-0">{row.status === "completed" ? "Terminée" : "En cours"}</Badge>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ConsultationDetail row={row} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Historique médical</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <section className="space-y-2">
                <h2 className="text-sm font-semibold">Antécédents médicaux</h2>
                {dossier.history.antecedents.length === 0 ? <p className="text-sm text-muted-foreground">Aucun antécédent renseigné.</p> : dossier.history.antecedents.map((item, index) => (
                  <div key={`${item.date}-${index}`} className="rounded-lg border px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">{formatDay(item.date)} · {item.doctorName}</p>
                    <p className="mt-1 whitespace-pre-wrap">{item.text}</p>
                  </div>
                ))}
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold">Allergies connues</h2>
                {dossier.history.allergies.length === 0 ? <p className="text-sm text-muted-foreground">Aucune allergie connue.</p> : (
                  <div className="flex flex-wrap gap-1">
                    {dossier.history.allergies.map((allergy) => <Badge key={allergy} variant="destructive">{allergy}</Badge>)}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold">Maladies chroniques</h2>
                <p className="text-sm text-muted-foreground">Non renseignées.</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold">Hospitalisations précédentes</h2>
                {dossier.history.hospitalizations.length === 0 ? <p className="text-sm text-muted-foreground">Aucune hospitalisation enregistrée.</p> : dossier.history.hospitalizations.map((stay) => (
                  <div key={stay.id} className="rounded-lg border px-3 py-2 text-sm">
                    <p className="font-medium">{stayStatusLabels[stay.status] ?? stay.status}{stay.ward ? ` · ${stay.ward}` : ""}{stay.room ? ` · Ch. ${stay.room}` : ""}</p>
                    <p className="text-xs text-muted-foreground">Admission {formatDateTime(stay.admittedAt)}{stay.dischargedAt ? ` · Sortie ${formatDateTime(stay.dischargedAt)}` : ""}</p>
                  </div>
                ))}
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold">Examens médicaux effectués</h2>
                {dossier.history.exams.length === 0 ? <p className="text-sm text-muted-foreground">Aucun examen enregistré.</p> : <ExamLines exams={dossier.history.exams} />}
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold">Autres informations</h2>
                {dossier.history.prescriptions.length === 0 ? <p className="text-sm text-muted-foreground">Aucune autre information enregistrée.</p> : dossier.history.prescriptions.map((prescription) => (
                  <div key={prescription.id} className="rounded-lg border px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">{formatDateTime(prescription.createdAt)} · {prescription.prescriberName}</p>
                    <div className="mt-1 space-y-1">
                      {prescription.items.map((item, index) => (
                        <p key={`${prescription.id}-${index}`}>{item.medication}{item.posology ? ` · ${item.posology}` : ""}{item.route ? ` · ${item.route}` : ""}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
