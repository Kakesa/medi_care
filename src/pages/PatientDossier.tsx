import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Droplets, FlaskConical, Phone, Printer, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiMessage } from "@/lib/apiError";
import { patientService, type DossierConsultation, type DossierExam, type PatientDossier } from "@/services/patientService";
import { downloadOrdonnance, lineFromItem, printOrdonnance, type OrdonnanceSheet } from "@/utils/ordonnance";

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

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate text-sm ${value ? "font-medium" : "text-muted-foreground"}`}>{value || "—"}</p>
    </div>
  );
}

function Note({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-background px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${value ? "" : "text-muted-foreground"}`}>{value || "Non renseigné"}</p>
    </div>
  );
}

function examLabel(exam: DossierExam) {
  if (exam.labStatus) return labStatusLabels[exam.labStatus] ?? exam.labStatus;
  return examStatusLabels[exam.status ?? ""] ?? exam.status ?? "Examen";
}

function ExamLines({ exams }: { exams: DossierExam[] }) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  if (!exams.length) return null;
  const toggle = (id: string) => setOpenIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <div className="space-y-2 border-t px-3 py-3 md:px-4">
      {exams.map((exam) => {
        const open = openIds.includes(exam.id);
        return (
          <article key={exam.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <button type="button" className="flex w-full items-center gap-3 px-3 py-3 text-left md:px-4" onClick={() => toggle(exam.id)} aria-expanded={open}>
              <span className="hidden h-10 w-1 shrink-0 rounded-full bg-sky-600 sm:block" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{exam.name}</span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <FlaskConical className="h-3 w-3 shrink-0" />
                  {formatDay(exam.date)}{exam.doctorName ? ` · ${exam.doctorName}` : ""}
                </span>
              </span>
              <Badge variant="outline" className="shrink-0">{examLabel(exam)}</Badge>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <p className="whitespace-pre-wrap border-t bg-muted/20 px-3 py-3 text-sm">{exam.results || "Résultat non disponible"}</p>
            )}
          </article>
        );
      })}
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
    <div className="grid gap-2 border-t border-border/70 bg-muted/20 px-3 py-3 md:grid-cols-2 md:px-4">
      <Note label="Date et heure" value={consultationWhen(row)} />
      <Note label="Médecin" value={row.doctorName} />
      <Note label="Motif de consultation" value={textOrEmpty(row.motif)} />
      <Note label="Symptômes et observations" value={observations || undefined} />
      <Note label="Diagnostic posé" value={diagnosis} />
      <Note label="Traitement et prescriptions" value={treatment || undefined} />
      <div className="space-y-2 md:col-span-2">
        <Note label="Examens demandés" value={requested} />
        <ExamLines exams={row.exams} />
        {requested && row.exams.length === 0 && <p className="text-sm text-muted-foreground">Résultat non disponible.</p>}
      </div>
      <div className="md:col-span-2">
        <Note label="Recommandations du médecin" value={recommendations || undefined} />
      </div>
    </div>
  );
}

export default function PatientDossier() {
  const { patientId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dossier, setDossier] = useState<PatientDossier | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [examsOpen, setExamsOpen] = useState(false);

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
  const sex = patient?.gender === "F" ? "Femme" : patient?.gender === "M" ? "Homme" : undefined;
  const initials = patient ? `${patient.firstName.slice(0, 1)}${patient.lastName.slice(0, 1)}`.toUpperCase() : "";
  const toggle = (id: string) => setOpenIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Button type="button" variant="ghost" className="-ml-2 h-8 px-2 text-sm" onClick={() => navigate("/dashboard/patients")}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Patients
      </Button>

      {loading && <p className="text-sm text-muted-foreground">Chargement du dossier…</p>}
      {error && <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

      {patient && dossier && (
        <>
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="bg-primary px-4 py-4 text-primary-foreground md:px-6">
              <p className="text-[11px] font-medium uppercase tracking-wide text-primary-foreground/80">Dossier médical</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-semibold">{initials}</div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold leading-tight md:text-3xl">{patient.lastName} {patient.firstName}</h1>
                  <p className="mt-0.5 truncate text-sm text-primary-foreground/85">
                    {[sex, age !== undefined ? `${age} ans` : undefined, patient.doctorName ? `Dr ${patient.doctorName}` : undefined].filter(Boolean).join(" · ") || "Identité incomplète"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{patientStatusLabels[patient.status] ?? patient.status}</span>
                {patient.room && <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">Ch. {patient.room}</span>}
                {patient.bloodType && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium"><Droplets className="h-3 w-3" />{patient.bloodType}</span>}
                {patient.phone && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium"><Phone className="h-3 w-3" />{patient.phone}</span>}
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x border-t">
              {[
                ["Consultations", dossier.consultations.length],
                ["Examens", dossier.history.exams.length],
                ["Séjours", dossier.history.hospitalizations.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="px-2 py-2 text-center md:py-3">
                  <p className="text-lg font-bold tabular-nums leading-none text-primary md:text-2xl">{value}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground md:text-xs">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm md:p-5">
            <h2 className="text-sm font-semibold md:text-base">Fiche du patient</h2>
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-2">
              <Fact label="Nom et postnom" value={patient.lastName} />
              <Fact label="Prénom" value={patient.firstName} />
              <Fact label="Sexe" value={sex} />
              <Fact label="Âge" value={age !== undefined ? `${age} ans` : undefined} />
              <Fact label="Naissance" value={patient.dateOfBirth ? formatDay(patient.dateOfBirth) : undefined} />
              <Fact label="Groupe sanguin" value={patient.bloodType} />
              <Fact label="Téléphone" value={patient.phone} />
              <Fact label="Email" value={patient.email} />
              <Fact label="Contact d'urgence" value={undefined} />
              <Fact label="Médecin" value={patient.doctorName} />
              <Fact label="Chambre" value={patient.room} />
              <Fact label="Inscrit le" value={patient.createdAt ? formatDay(patient.createdAt) : undefined} />
            </div>
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm"><span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Adresse</span><br />{patient.address || "—"}</p>
            <div className="grid grid-cols-3 gap-1.5">
              <Fact label="Température" value={patient.temperature != null ? `${patient.temperature.toLocaleString("fr-FR")} °C` : undefined} />
              <Fact label="Tension" value={patient.tension} />
              <Fact label="Saturation" value={patient.saturation != null ? `${patient.saturation} %` : undefined} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold md:text-base">Historique des consultations</h2>
            {dossier.consultations.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">Aucune consultation antérieure enregistrée pour ce patient.</p>
            ) : (
              <div className="space-y-2">
                {dossier.consultations.map((row) => {
                  const open = openIds.includes(row.id);
                  return (
                    <article key={row.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                      <button type="button" className="flex w-full items-center gap-3 px-3 py-3 text-left md:px-4" onClick={() => toggle(row.id)} aria-expanded={open}>
                        <span className="hidden h-10 w-1 shrink-0 rounded-full bg-primary sm:block" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{consultationWhen(row)}</span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Stethoscope className="h-3 w-3 shrink-0" />
                            {row.doctorName}{row.motif ? ` · ${row.motif}` : ""}
                          </span>
                        </span>
                        <Badge variant="outline" className={row.status === "completed" ? "border-emerald-300 text-emerald-800" : "border-amber-300 text-amber-800"}>{row.status === "completed" ? "Terminée" : "En cours"}</Badge>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                      </button>
                      {open && <ConsultationDetail row={row} />}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            {dossier.history.exams.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">Aucun examen enregistré.</p>
            ) : (
              <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <button type="button" className="flex w-full items-center gap-3 px-3 py-3 text-left md:px-4" onClick={() => setExamsOpen((current) => !current)} aria-expanded={examsOpen}>
                  <span className="hidden h-10 w-1 shrink-0 rounded-full bg-sky-600 sm:block" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Examens médicaux</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{dossier.history.exams.length} examen{dossier.history.exams.length > 1 ? "s" : ""}</span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-primary">{examsOpen ? "Masquer" : "Afficher"}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${examsOpen ? "rotate-180" : ""}`} />
                </button>
                {examsOpen && <ExamLines exams={dossier.history.exams} />}
              </article>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm md:p-5">
            <h2 className="text-sm font-semibold md:text-base">Historique médical</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                <h3 className="text-sm font-semibold">Antécédents</h3>
                {dossier.history.antecedents.length === 0 ? <p className="text-sm text-muted-foreground">Aucun antécédent renseigné.</p> : dossier.history.antecedents.map((item, index) => (
                  <div key={`${item.date}-${index}`} className="rounded-lg bg-background px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">{formatDay(item.date)} · {item.doctorName}</p>
                    <p className="mt-1 whitespace-pre-wrap">{item.text}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="rounded-xl bg-muted/40 p-3">
                  <h3 className="text-sm font-semibold">Allergies</h3>
                  {dossier.history.allergies.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Aucune allergie connue.</p> : (
                    <div className="mt-2 flex flex-wrap gap-1">{dossier.history.allergies.map((allergy) => <Badge key={allergy} variant="destructive">{allergy}</Badge>)}</div>
                  )}
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <h3 className="text-sm font-semibold">Maladies chroniques</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Non renseignées.</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Hospitalisations</h3>
              {dossier.history.hospitalizations.length === 0 ? <p className="text-sm text-muted-foreground">Aucune hospitalisation enregistrée.</p> : (
                <div className="grid gap-2 md:grid-cols-2">
                  {dossier.history.hospitalizations.map((stay) => (
                    <div key={stay.id} className="rounded-xl border px-3 py-2 text-sm">
                      <p className="font-medium">{stayStatusLabels[stay.status] ?? stay.status}{stay.ward ? ` · ${stay.ward}` : ""}{stay.room ? ` · Ch. ${stay.room}` : ""}</p>
                      <p className="text-xs text-muted-foreground">Admission {formatDay(stay.admittedAt)}{stay.dischargedAt ? ` · Sortie ${formatDay(stay.dischargedAt)}` : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Prescriptions</h3>
              {dossier.history.prescriptions.length === 0 ? <p className="text-sm text-muted-foreground">Aucune autre information enregistrée.</p> : dossier.history.prescriptions.map((prescription) => {
                const sheet: OrdonnanceSheet = {
                  organization: {
                    name: user?.organization?.name || "Établissement",
                    address: user?.organization?.address,
                    phone: user?.organization?.phone,
                    email: user?.organization?.email,
                    city: user?.organization?.city,
                    logo: user?.organization?.logo,
                    stamp: user?.organization?.stamp,
                  },
                  patientName: `${dossier.patient.lastName} ${dossier.patient.firstName}`,
                  age: ageOf(dossier.patient.dateOfBirth) !== undefined ? `${ageOf(dossier.patient.dateOfBirth)} ans` : "—",
                  sex: dossier.patient.gender === "M" ? "masculin" : dossier.patient.gender === "F" ? "féminin" : "sexe non renseigné",
                  recordNumber: dossier.patient.id.slice(-8).toUpperCase(),
                  date: formatDateTime(prescription.createdAt),
                  doctorName: prescription.prescriberName,
                  lines: prescription.items.map((item) => lineFromItem({
                    medication: item.medication,
                    dosage: item.dosage || "",
                    posology: item.posology || "",
                    duration: item.duration || "",
                    administrationRoute: item.route,
                    instructions: item.instructions,
                  })),
                  recommendations: prescription.recommendations || "",
                };
                return (
                  <div key={prescription.id} className="rounded-xl border px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{formatDateTime(prescription.createdAt)} · {prescription.prescriberName}</p>
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => printOrdonnance(sheet)}>
                        <Printer className="h-3.5 w-3.5" />
                        Imprimer
                      </Button>
                    </div>
                    <div className="mt-1 space-y-1">
                      {prescription.items.map((item, index) => {
                        const line = sheet.lines[index];
                        return (
                          <div key={`${prescription.id}-${index}`}>
                            <p><span className="font-serif font-bold">R/</span> {item.medication}</p>
                            <p className="pl-5"><span className="font-serif font-bold">S/</span> {[item.dosage, item.posology].filter((part) => part && part !== "Selon prescription").join(" par ") || "—"}{item.duration && item.duration !== "Selon prescription" ? ` pendant ${item.duration}` : ""}</p>
                            {line?.instructions ? <p className="pl-5 text-xs text-muted-foreground">{line.instructions}</p> : null}
                          </div>
                        );
                      })}
                    </div>
                    {prescription.recommendations ? <p className="mt-2 text-xs text-muted-foreground">{prescription.recommendations}</p> : null}
                    <button type="button" className="mt-1 text-xs text-primary" onClick={() => downloadOrdonnance(sheet)}>Télécharger le PDF</button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
