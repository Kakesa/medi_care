import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { formatMoney } from "@/lib/money";
import { billingService } from "@/services/billingService";
import { examService, type ExamCatalogItem } from "@/services/examService";
import { labService, labStatusLabels, type LabExam } from "@/services/labService";
import { patientService } from "@/services/patientService";
import { personnelService } from "@/services/personnelService";
import type { Patient, PaymentMethod, Personnel } from "@/types";

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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Personnel[]>([]);
  const [catalog, setCatalog] = useState<ExamCatalogItem[]>([]);
  const [rows, setRows] = useState<LabExam[]>([]);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");

  const load = async () => {
    try {
      const [patientResult, doctorResult, catalogResult, exams] = await Promise.all([
        patientService.getAll({ limit: 100 }),
        personnelService.getDoctors(),
        examService.catalog(),
        labService.list(),
      ]);
      setPatients(patientResult.data);
      setDoctors(doctorResult);
      setCatalog(catalogResult.items.filter((item) => item.type === "laboratory"));
      setRows(exams);
    } catch (error) {
      toast({ variant: "destructive", title: "Laboratoire indisponible", description: apiMessage(error) });
    }
  };

  useEffect(() => { void load(); }, []);

  const order = async () => {
    const items = catalog.filter((item) => picked.includes(item.id)).map((item) => ({
      kind: item.kind,
      catalogItemId: item.id,
      name: item.name,
      category: item.categoryName || "Laboratoire",
    }));
    try {
      const created = await labService.order({ patientId, doctorId, instructions, items });
      setInvoiceId(created.invoiceId || "");
      setPicked([]);
      await load();
      toast({
        title: "Demande transmise au laboratoire",
        description: created.invoiceNumber ? `Facture ${created.invoiceNumber}` : "Examens sans tarif : ils sont transmis, sans facture.",
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Demande impossible", description: apiMessage(error) });
    }
  };

  const pay = async () => {
    try {
      await billingService.finalizeInvoice(invoiceId);
      await billingService.markAsPaid(invoiceId, method, reference);
      setReference("");
      await load();
      toast({ title: "Paiement enregistré", description: "Le résultat reste indépendant de cet encaissement." });
    } catch (error) {
      toast({ variant: "destructive", title: "Encaissement impossible", description: apiMessage(error) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Demandes de laboratoire</h1>
        <p className="mt-1 text-muted-foreground">Enregistrez les examens, encaissez la facture, puis suivez le rapport validé.</p>
      </div>
      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{patients.map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Médecin demandeur</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{doctors.map((doctor) => <SelectItem key={doctor.id} value={doctor.id}>Dr. {doctor.firstName} {doctor.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Textarea value={instructions} placeholder="Instructions pour le laboratoire" onChange={(event) => setInstructions(event.target.value)} />
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {catalog.map((item) => (
              <label key={item.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={picked.includes(item.id)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                  {item.name}
                </span>
                <span>{item.unitPrice == null ? "—" : formatMoney(item.unitPrice, item.currency || "EUR")}</span>
              </label>
            ))}
          </div>
          <Button disabled={!patientId || !doctorId || picked.length === 0} onClick={() => void order()}>Transmettre {picked.length || ""} examen(s)</Button>
          {invoiceId && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="card">Carte</SelectItem>
                  <SelectItem value="transfer">Virement</SelectItem>
                  <SelectItem value="insurance">Assurance</SelectItem>
                </SelectContent>
              </Select>
              <Input value={reference} placeholder="Référence de transaction" onChange={(event) => setReference(event.target.value)} />
              <Button variant="outline" onClick={() => void pay()}>Encaisser la facture</Button>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="space-y-2">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{row.patientName} · {row.name}</p>
                <p className="text-sm text-muted-foreground">{row.invoiceNumber || "Sans facture"} · {row.paymentStatus}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={row.official ? "default" : "secondary"}>{labStatusLabels[row.labStatus]}</Badge>
                {row.official && <Button size="sm" variant="outline" onClick={() => printReport(row)}>Imprimer</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
