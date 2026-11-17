import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, FlaskConical, RotateCcw, Search, Send, XCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { labActionLabel, labOriginLabel, labService, labStatusLabels, type LabExam, type LabStatus } from "@/services/labService";

const queues: Array<{ status: LabStatus; label: string; icon: LucideIcon }> = [
  { status: "EN_ATTENTE", label: "En attente", icon: Clock },
  { status: "EN_COURS", label: "En cours", icon: FlaskConical },
  { status: "EN_ATTENTE_VALIDATION", label: "Soumis", icon: Send },
  { status: "CORRECTION_DEMANDEE", label: "Corrections", icon: RotateCcw },
  { status: "VALIDE", label: "Terminés", icon: CheckCircle2 },
  { status: "REJETE", label: "Rejetés", icon: XCircle },
];

const editable: LabStatus[] = ["EN_COURS", "BROUILLON", "CORRECTION_DEMANDEE", "REJETE"];

const tones: Record<LabStatus, string> = {
  EN_ATTENTE: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  EN_COURS: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
  EN_ATTENTE_VALIDATION: "border-primary/25 bg-primary/10 text-primary",
  CORRECTION_DEMANDEE: "border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100",
  VALIDE: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
  REJETE: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  BROUILLON: "",
  ANNULE: "",
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

function inQueue(row: LabExam, status: LabStatus) {
  return row.labStatus === status || (status === "EN_COURS" && row.labStatus === "BROUILLON");
}

function dayLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function readFile(file: File) {
  return new Promise<{ name: string; mimeType: string; data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mimeType: file.type, data: String(reader.result || "") });
    reader.onerror = () => reject(new Error("Fichier illisible"));
    reader.readAsDataURL(file);
  });
}

export default function LaborantinWorkspace() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LabExam[]>([]);
  const [selected, setSelected] = useState<LabExam | null>(null);
  const [filter, setFilter] = useState<LabStatus>("EN_ATTENTE");
  const [filterChosen, setFilterChosen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<Array<{ name: string; mimeType: string; data: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setRows(await labService.list());
    } catch (error) {
      toast({ variant: "destructive", title: "Laboratoire indisponible", description: apiMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => {
    const next = {} as Record<LabStatus, number>;
    for (const queue of queues) next[queue.status] = rows.filter((row) => inQueue(row, queue.status)).length;
    return next;
  }, [rows]);

  useEffect(() => {
    if (loading || filterChosen) return;
    const preferred = (["EN_ATTENTE", "EN_COURS", "CORRECTION_DEMANDEE", "REJETE"] as LabStatus[]).find((status) => counts[status] > 0);
    if (preferred) setFilter(preferred);
  }, [loading, filterChosen, counts]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!inQueue(row, filter)) return false;
      if (!term) return true;
      return row.name.toLowerCase().includes(term) || row.patientName.toLowerCase().includes(term);
    });
  }, [rows, filter, query]);

  const openExam = selected && visible.some((row) => row.id === selected.id) ? selected : null;

  const open = async (id: string) => {
    try {
      const exam = await labService.get(id);
      setSelected(exam);
      setResults(exam.draftResults || "");
      setNotes(exam.technicalNotes || "");
      setFiles([]);
    } catch (error) {
      toast({ variant: "destructive", title: "Dossier indisponible", description: apiMessage(error) });
    }
  };

  const run = async (action: () => Promise<LabExam>, title: string) => {
    try {
      const exam = await action();
      setSelected(exam);
      setResults(exam.draftResults || "");
      setNotes(exam.technicalNotes || "");
      setFiles([]);
      const next = exam.labStatus === "BROUILLON" ? "EN_COURS" : exam.labStatus;
      if (queues.some((queue) => queue.status === next)) {
        setFilterChosen(true);
        setFilter(next);
      }
      await load();
      toast({ title });
    } catch (error) {
      toast({ variant: "destructive", title: "Action impossible", description: apiMessage(error) });
    }
  };

  const activeQueue = queues.find((queue) => queue.status === filter) ?? queues[0];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <FlaskConical className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground md:text-3xl">Laboratoire</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choisissez une étape, puis ouvrez le dossier pour saisir ou soumettre le résultat.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {queues.map((queue) => {
          const active = filter === queue.status;
          return (
            <button
              key={queue.status}
              type="button"
              onClick={() => { setFilterChosen(true); setFilter(queue.status); }}
              className={cn(
                "rounded-2xl border p-3 text-left transition-shadow",
                tones[queue.status],
                active ? "shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:shadow-sm",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">{queue.label}</p>
                <queue.icon className="h-4 w-4 shrink-0" />
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{counts[queue.status] ?? 0}</p>
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <activeQueue.icon className="h-4 w-4 text-primary" />
              {activeQueue.label}
            </CardTitle>
            <div className="relative w-full sm:max-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Patient ou examen" className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? <p className="py-6 text-sm text-muted-foreground">Chargement...</p> : visible.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Aucun examen dans cette étape.</p>
            ) : visible.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => void open(row.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                  openExam?.id === row.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/40 hover:bg-muted",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(row.patientName)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{row.patientName}</span>
                  <span className="block truncate text-sm text-muted-foreground">{row.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{dayLabel(row.date)}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        {openExam ? (
          <Card className="lg:sticky lg:top-20">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="font-medium">{openExam.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {openExam.patient?.firstName} {openExam.patient?.lastName}
                      {openExam.patient?.phone ? ` · ${openExam.patient.phone}` : ""}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">{labStatusLabels[openExam.labStatus]}</Badge>
              </div>
              <p className="text-sm">{labOriginLabel(openExam)}</p>
              {openExam.patient?.allergies?.length ? (
                <p className="text-sm text-destructive">Allergies : {openExam.patient.allergies.join(", ")}</p>
              ) : null}
              {openExam.history.length > 0 && (
                <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  {openExam.history.slice(-4).map((entry, index) => (
                    <p key={`${entry.action}-${index}`}>{entry.userName} · {labActionLabel(entry.action)}{entry.comment ? ` · ${entry.comment}` : ""}</p>
                  ))}
                </div>
              )}
              {openExam.labStatus === "EN_ATTENTE" && (
                <Button onClick={() => run(() => labService.start(openExam.id), "Examen en cours")}>Démarrer</Button>
              )}
              {editable.includes(openExam.labStatus) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="lab-results">Résultats</Label>
                    <Textarea id="lab-results" value={results} onChange={(event) => setResults(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lab-notes">Observations techniques</Label>
                    <Textarea id="lab-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lab-file">Pièce jointe</Label>
                    <Input id="lab-file" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void readFile(file).then((attachment) => setFiles((current) => [...current, attachment].slice(0, 2))).catch(() => toast({ variant: "destructive", title: "Fichier refusé" }));
                    }} />
                    {files.map((file) => <p key={file.name} className="text-xs text-muted-foreground">{file.name}</p>)}
                  </div>
                  <Button onClick={() => run(() => labService.submit(openExam.id, { results, technicalNotes: notes, attachments: files }), "Soumis pour validation")}>Soumettre</Button>
                </>
              )}
              {openExam.labStatus === "EN_ATTENTE_VALIDATION" && (
                <p className="text-sm">Résultat envoyé : {openExam.draftResults || openExam.results || "—"}</p>
              )}
              {openExam.labStatus === "VALIDE" && <p className="text-sm">Résultat officiel : {openExam.results || "—"}</p>}
            </CardContent>
          </Card>
        ) : (
          <Card className="hidden lg:block">
            <CardContent className="flex min-h-48 items-center justify-center p-6 text-sm text-muted-foreground">
              Sélectionnez un examen.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
