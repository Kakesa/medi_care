import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAckExamResults } from "@/contexts/WorkBadgeContext";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { labService, labStatusLabels, type LabExam } from "@/services/labService";

const paymentLabels: Record<string, string> = {
  unbilled: "Sans facture",
  draft: "Brouillon",
  pending: "À payer",
  paid: "Payé",
  overdue: "En retard",
  cancelled: "Annulé",
};

function printReport(exam: LabExam) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return;
  popup.document.write(`<html><head><title>${exam.name}</title></head><body><h1>${exam.name}</h1><p>${exam.patientName}</p><p>${exam.date} · ${exam.doctorName}</p><h2>Résultat validé</h2><p>${exam.results}</p></body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function ReceptionLab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LabExam[]>([]);
  useAckExamResults(rows.flatMap((row) => (row.official ? [row.id] : [])));
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const load = async () => {
    try {
      setRows(await labService.list());
    } catch (error) {
      toast({ variant: "destructive", title: "Laboratoire indisponible", description: apiMessage(error) });
    }
  };

  useEffect(() => { void load(); }, []);

  const patientsWithExams = [...rows.reduce((groups, row) => {
    const current = groups.get(row.patientId) || [];
    current.push(row);
    groups.set(row.patientId, current);
    return groups;
  }, new Map<string, LabExam[]>()).entries()].map(([id, exams]) => ({
    id,
    name: exams[0]?.patientName || "Patient",
    exams,
  }));
  const selectedPatient = patientsWithExams.find((patient) => patient.id === selectedPatientId) || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Demandes de laboratoire</h1>
        <p className="mt-1 text-muted-foreground">Les examens demandés depuis les consultations.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {patientsWithExams.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">Aucune demande pour le moment.</p>
        )}
        {patientsWithExams.map((patient) => (
          <Card key={patient.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setSelectedPatientId(patient.id)}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <p className="font-medium">{patient.name}</p>
              <Badge variant="secondary">{patient.exams.length} examen{patient.exams.length > 1 ? "s" : ""}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedPatient} onOpenChange={(open) => { if (!open) setSelectedPatientId(null); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPatient?.name}</DialogTitle>
            <DialogDescription>{selectedPatient ? `${selectedPatient.exams.length} examen${selectedPatient.exams.length > 1 ? "s" : ""} demandé${selectedPatient.exams.length > 1 ? "s" : ""}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedPatient?.exams.map((exam) => (
              <div key={exam.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{exam.name}</p>
                  <p className="text-sm text-muted-foreground">{exam.invoiceNumber || "Sans facture"} · {paymentLabels[exam.paymentStatus] || exam.paymentStatus}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={exam.official ? "default" : "secondary"}>{labStatusLabels[exam.labStatus]}</Badge>
                  {exam.official && <Button size="sm" variant="outline" onClick={() => printReport(exam)}>Imprimer</Button>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
