import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
import { useAckExamResults } from "@/contexts/WorkBadgeContext";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { labService, labStatusLabels, type LabExam, type LabStatus } from "@/services/labService";
import { userAdminService } from "@/services/userAdminService";

const groups: LabStatus[] = ["EN_ATTENTE_VALIDATION", "EN_COURS", "BROUILLON", "CORRECTION_DEMANDEE", "REJETE", "VALIDE", "EN_ATTENTE"];
const patientsPerPage = 10;
const paymentLabels: Record<string, string> = {
  unbilled: "Sans facture",
  draft: "Brouillon",
  pending: "À payer",
  paid: "Payé",
  overdue: "En retard",
  cancelled: "Annulé",
};

export default function LabSupervision() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LabExam[]>([]);
  const [selected, setSelected] = useState<LabExam | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  useAckExamResults(
    selected && (selected.results || selected.draftResults || selected.official || selected.versions.length > 0)
      ? [selected.id]
      : [],
  );
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

  const patients = Array.from(
    rows.reduce((grouped, row) => {
      if (!grouped.has(row.patientId)) {
        grouped.set(row.patientId, { id: row.patientId, name: row.patientName });
      }
      return grouped;
    }, new Map<string, { id: string; name: string }>()),
    ([, patient]) => patient,
  ).sort((a, b) => {
    const aIsEspoir = a.name.localeCompare("Espoir Kakesa", "fr", { sensitivity: "base" }) === 0;
    const bIsEspoir = b.name.localeCompare("Espoir Kakesa", "fr", { sensitivity: "base" }) === 0;
    if (aIsEspoir !== bIsEspoir) return aIsEspoir ? -1 : 1;
    return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  });
  const pageCount = Math.ceil(patients.length / patientsPerPage);
  const activePage = Math.min(currentPage, Math.max(pageCount, 1));
  const pagePatients = patients.slice((activePage - 1) * patientsPerPage, activePage * patientsPerPage);

  const changePage = (page: number) => {
    setCurrentPage(page);
    setSelectedPatientId(null);
    setSelected(null);
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
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {pagePatients.map((patient) => {
              const patientExams = rows.filter((row) => row.patientId === patient.id);
              const isExpanded = selectedPatientId === patient.id;
              return (
                <Card key={patient.id} className={isExpanded ? "border-primary sm:col-span-2" : ""}>
                  <CardContent className="p-4">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      className="flex w-full items-center justify-between gap-3 text-left"
                      onClick={() => {
                        setSelectedPatientId(isExpanded ? null : patient.id);
                        setSelected(null);
                      }}
                    >
                      <span className="font-semibold">{patient.name}</span>
                      <Badge variant={isExpanded ? "default" : "secondary"}>
                        {patientExams.length} examen{patientExams.length > 1 ? "s" : ""}
                      </Badge>
                    </button>
                    {isExpanded && (
                      <div className="mt-4 space-y-2">
                        {patientExams.map((exam) => (
                          <button
                            key={exam.id}
                            type="button"
                            className="flex w-full flex-col gap-2 rounded-lg border p-3 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                            onClick={() => void open(exam.id)}
                          >
                            <span className="font-medium">{exam.name}</span>
                            <span className="flex flex-wrap items-center gap-2">
                              <Badge variant={exam.labStatus === "VALIDE" ? "default" : "secondary"}>{labStatusLabels[exam.labStatus]}</Badge>
                              <span className="text-xs text-muted-foreground">{paymentLabels[exam.paymentStatus] || exam.paymentStatus}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {patients.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                Patients {(activePage - 1) * patientsPerPage + 1} à {Math.min(activePage * patientsPerPage, patients.length)} sur {patients.length}
              </p>
              {pageCount > 1 && (
                <Pagination className="mx-0 w-auto">
                  <PaginationContent className="flex-wrap justify-center">
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        aria-disabled={activePage === 1}
                        className={activePage === 1 ? "pointer-events-none opacity-50" : ""}
                        onClick={(event) => {
                          event.preventDefault();
                          if (activePage > 1) changePage(activePage - 1);
                        }}
                      />
                    </PaginationItem>
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          size="icon"
                          isActive={page === activePage}
                          aria-label={`Page ${page}`}
                          onClick={(event) => {
                            event.preventDefault();
                            changePage(page);
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        aria-disabled={activePage === pageCount}
                        className={activePage === pageCount ? "pointer-events-none opacity-50" : ""}
                        onClick={(event) => {
                          event.preventDefault();
                          if (activePage < pageCount) changePage(activePage + 1);
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
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
