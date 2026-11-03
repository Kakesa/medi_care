import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { labService, labStatusLabels, type LabExam, type LabStatus } from "@/services/labService";

const queues: Array<{ status: LabStatus; label: string }> = [
  { status: "EN_ATTENTE", label: "En attente" },
  { status: "EN_COURS", label: "En cours" },
  { status: "BROUILLON", label: "Brouillons" },
  { status: "EN_ATTENTE_VALIDATION", label: "Soumis" },
  { status: "CORRECTION_DEMANDEE", label: "Corrections" },
  { status: "VALIDE", label: "Terminés" },
  { status: "REJETE", label: "Rejetés" },
];

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
      await load();
      toast({ title });
    } catch (error) {
      toast({ variant: "destructive", title: "Action impossible", description: apiMessage(error) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Laboratoire</h1>
        <p className="mt-1 text-muted-foreground">Saisissez les résultats. Seule l'administration peut les valider.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {queues.map((queue) => (
          <Card key={queue.status}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{queue.label}</p>
              <p className="text-2xl font-bold">{rows.filter((row) => row.labStatus === queue.status).length}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Tabs defaultValue="EN_ATTENTE">
        <TabsList>
          {queues.map((queue) => <TabsTrigger key={queue.status} value={queue.status}>{queue.label}</TabsTrigger>)}
        </TabsList>
        {queues.map((queue) => (
          <TabsContent key={queue.status} value={queue.status} className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-2">
              {loading ? <p className="text-muted-foreground">Chargement...</p> : rows.filter((row) => row.labStatus === queue.status).length === 0 ? (
                <p className="text-muted-foreground">Aucun examen</p>
              ) : rows.filter((row) => row.labStatus === queue.status).map((row) => (
                <button key={row.id} type="button" className="w-full rounded-xl border bg-card p-4 text-left" onClick={() => void open(row.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{row.name}</p>
                    <Badge variant="secondary">{labStatusLabels[row.labStatus]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{row.patientName} · {row.date}</p>
                </button>
              ))}
            </div>
            {selected && selected.labStatus === queue.status ? (
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{selected.name}</p>
                      <p className="text-sm text-muted-foreground">{selected.patient?.firstName} {selected.patient?.lastName} · {selected.patient?.dateOfBirth || "date inconnue"} · {selected.patient?.phone || "sans téléphone"}</p>
                    </div>
                  </div>
                  <p className="text-sm">{selected.instructions || "Aucune instruction"}</p>
                  {selected.patient?.allergies?.length ? <p className="text-sm text-destructive">Allergies : {selected.patient.allergies.join(", ")}</p> : null}
                  {selected.history.length > 0 && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {selected.history.slice(-4).map((entry, index) => (
                        <p key={`${entry.action}-${index}`}>{entry.userName} · {entry.action}{entry.comment ? ` · ${entry.comment}` : ""}</p>
                      ))}
                    </div>
                  )}
                  {selected.labStatus === "EN_ATTENTE" && <Button onClick={() => run(() => labService.start(selected.id), "Examen en cours")}>Démarrer</Button>}
                  {["EN_COURS", "BROUILLON", "CORRECTION_DEMANDEE", "REJETE"].includes(selected.labStatus) && (
                    <>
                      <div className="space-y-2">
                        <Label>Résultats</Label>
                        <Textarea value={results} onChange={(event) => setResults(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Observations techniques</Label>
                        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
                      </div>
                      <Input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        void readFile(file).then((attachment) => setFiles((current) => [...current, attachment].slice(0, 2))).catch(() => toast({ variant: "destructive", title: "Fichier refusé" }));
                      }} />
                      {files.map((file) => <p key={file.name} className="text-xs text-muted-foreground">{file.name}</p>)}
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => run(() => labService.draft(selected.id, { results, technicalNotes: notes, attachments: files }), "Brouillon enregistré")}>Enregistrer le brouillon</Button>
                        {selected.labStatus === "BROUILLON" && <Button onClick={() => run(() => labService.submit(selected.id), "Soumis pour validation")}>Soumettre</Button>}
                      </div>
                    </>
                  )}
                  {selected.labStatus === "VALIDE" && <p className="text-sm">Résultat officiel : {selected.results}</p>}
                </CardContent>
              </Card>
            ) : <p className="text-sm text-muted-foreground">Sélectionnez un examen.</p>}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
