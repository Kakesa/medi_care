import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { labService, labStatusLabels, type LabExam, type LabStatus } from "@/services/labService";
import { userAdminService } from "@/services/userAdminService";

const groups: LabStatus[] = ["EN_ATTENTE_VALIDATION", "EN_COURS", "BROUILLON", "CORRECTION_DEMANDEE", "REJETE", "VALIDE", "EN_ATTENTE"];

export default function LabSupervision() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LabExam[]>([]);
  const [selected, setSelected] = useState<LabExam | null>(null);
  const [comment, setComment] = useState("");
  const [account, setAccount] = useState({ firstName: "", lastName: "", email: "" });

  const load = async () => {
    try {
      setRows(await labService.list());
    } catch (error) {
      toast({ variant: "destructive", title: "Supervision indisponible", description: apiMessage(error) });
    }
  };

  useEffect(() => { void load(); }, []);

  const open = async (id: string) => {
    try {
      setSelected(await labService.get(id));
      setComment("");
    } catch (error) {
      toast({ variant: "destructive", title: "Dossier indisponible", description: apiMessage(error) });
    }
  };

  const decide = async (action: "validate" | "correction" | "reject") => {
    if (!selected) return;
    try {
      const exam = action === "validate"
        ? await labService.validate(selected.id, comment)
        : action === "correction"
          ? await labService.correction(selected.id, comment)
          : await labService.reject(selected.id, comment);
      setSelected(exam);
      await load();
      toast({ title: action === "validate" ? "Résultat validé" : action === "correction" ? "Correction demandée" : "Résultat rejeté" });
    } catch (error) {
      toast({ variant: "destructive", title: "Décision impossible", description: apiMessage(error) });
    }
  };

  const invite = async () => {
    try {
      await userAdminService.create({ ...account, role: "LABORANTIN" });
      setAccount({ firstName: "", lastName: "", email: "" });
      toast({ title: "Laborantin invité", description: "Un mot de passe temporaire lui a été envoyé." });
    } catch (error) {
      toast({ variant: "destructive", title: "Invitation impossible", description: apiMessage(error) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Supervision du laboratoire</h1>
        <p className="mt-1 text-muted-foreground">L'administrateur valide les résultats. Le paiement de l'examen reste une opération distincte.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {groups.map((status) => (
          <Card key={status}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{labStatusLabels[status]}</p><p className="text-2xl font-bold">{rows.filter((row) => row.labStatus === status).length}</p></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <div className="space-y-2"><Label>Prénom</Label><Input value={account.firstName} onChange={(event) => setAccount({ ...account, firstName: event.target.value })} /></div>
          <div className="space-y-2"><Label>Nom</Label><Input value={account.lastName} onChange={(event) => setAccount({ ...account, lastName: event.target.value })} /></div>
          <div className="space-y-2"><Label>E-mail</Label><Input value={account.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} /></div>
          <div className="flex items-end"><Button className="w-full" onClick={() => void invite()}>Inviter un laborantin</Button></div>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-2">
          {rows.map((row) => (
            <button key={row.id} type="button" className="w-full rounded-xl border bg-card p-4 text-left" onClick={() => void open(row.id)}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{row.patientName}</p>
                <Badge variant={row.labStatus === "VALIDE" ? "default" : "secondary"}>{labStatusLabels[row.labStatus]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{row.name} · paiement {row.paymentStatus}</p>
            </button>
          ))}
        </div>
        {selected ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="font-medium">{selected.name} · {selected.patientName}</p>
              <p className="text-sm text-muted-foreground">{selected.instructions || "Aucune instruction"}</p>
              <p className="text-sm">Brouillon : {selected.draftResults || "—"}</p>
              <p className="text-sm">Observations : {selected.technicalNotes || "—"}</p>
              <p className="text-sm">Résultat officiel : {selected.official ? selected.results : "Pas encore validé"}</p>
              {selected.labStatus !== "EN_ATTENTE_VALIDATION" && selected.labStatus !== "VALIDE" && (
                <p className="text-sm text-muted-foreground">Ce dossier est « {labStatusLabels[selected.labStatus]} ». La validation sera possible quand le laborantin aura soumis le résultat.</p>
              )}
              {selected.attachments.map((file) => file.data ? <a key={file.name} className="block text-sm text-primary" href={file.data} download={file.name}>{file.name}</a> : <p key={file.name} className="text-sm">{file.name}</p>)}
              <div className="space-y-1 text-xs text-muted-foreground">
                {selected.versions.map((version) => (
                  <p key={version.version}>Version {version.version} · {version.submittedByName} · {version.decision || "en attente"} {version.comment}</p>
                ))}
              </div>
              <Textarea value={comment} placeholder="Observation, correction ou motif de rejet" onChange={(event) => setComment(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button disabled={selected.labStatus !== "EN_ATTENTE_VALIDATION"} onClick={() => void decide("validate")}>Valider</Button>
                <Button variant="outline" disabled={selected.labStatus !== "EN_ATTENTE_VALIDATION" && selected.labStatus !== "VALIDE"} onClick={() => void decide("correction")}>Demander une correction</Button>
                <Button variant="destructive" disabled={selected.labStatus !== "EN_ATTENTE_VALIDATION"} onClick={() => void decide("reject")}>Rejeter</Button>
              </div>
            </CardContent>
          </Card>
        ) : <p className="text-sm text-muted-foreground">Sélectionnez une demande.</p>}
      </div>
    </div>
  );
}
