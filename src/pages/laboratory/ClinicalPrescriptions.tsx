import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { labService, type LabExam } from "@/services/labService";
import { pharmacyStatusLabels, prescriptionService, type PrescriptionRecord } from "@/services/prescriptionService";

const emptyItem = { medication: "", dosage: "", posology: "", duration: "", instructions: "", quantityPrescribed: "1" };

export default function ClinicalPrescriptions() {
  const { toast } = useToast();
  const [exams, setExams] = useState<LabExam[]>([]);
  const [rows, setRows] = useState<PrescriptionRecord[]>([]);
  const [examId, setExamId] = useState("");
  const [item, setItem] = useState(emptyItem);

  const load = async () => {
    try {
      const [labRows, prescriptions] = await Promise.all([labService.list("VALIDE"), prescriptionService.list()]);
      setExams(labRows.filter((row) => row.official));
      setRows(prescriptions);
    } catch (error) {
      toast({ variant: "destructive", title: "Ordonnances indisponibles", description: apiMessage(error) });
    }
  };

  useEffect(() => { void load(); }, []);

  const create = async () => {
    const exam = exams.find((row) => row.id === examId);
    if (!exam) return;
    try {
      await prescriptionService.create({
        patientId: exam.patientId,
        examId: exam.id,
        items: [{ ...item, quantityPrescribed: Number(item.quantityPrescribed) }],
      });
      setItem(emptyItem);
      await load();
      toast({ title: "Ordonnance enregistrée", description: "Validez-la pour la transmettre à la pharmacie." });
    } catch (error) {
      toast({ variant: "destructive", title: "Ordonnance impossible", description: apiMessage(error) });
    }
  };

  const publish = async (id: string) => {
    try {
      await prescriptionService.validate(id);
      await load();
      toast({ title: "Ordonnance transmise à la pharmacie" });
    } catch (error) {
      toast({ variant: "destructive", title: "Validation impossible", description: apiMessage(error) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ordonnances</h1>
        <p className="mt-1 text-muted-foreground">À partir d'un résultat validé. Le laborantin ne prescrit pas.</p>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="space-y-2">
            <Label>Résultat validé</Label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger><SelectValue placeholder="Choisir un examen validé" /></SelectTrigger>
              <SelectContent>{exams.map((exam) => <SelectItem key={exam.id} value={exam.id}>{exam.patientName} · {exam.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Médicament" value={item.medication} onChange={(event) => setItem({ ...item, medication: event.target.value })} />
            <Input placeholder="Dosage" value={item.dosage} onChange={(event) => setItem({ ...item, dosage: event.target.value })} />
            <Input placeholder="Posologie" value={item.posology} onChange={(event) => setItem({ ...item, posology: event.target.value })} />
            <Input placeholder="Durée" value={item.duration} onChange={(event) => setItem({ ...item, duration: event.target.value })} />
            <Input placeholder="Instructions" value={item.instructions} onChange={(event) => setItem({ ...item, instructions: event.target.value })} />
            <Input type="number" min={1} value={item.quantityPrescribed} onChange={(event) => setItem({ ...item, quantityPrescribed: event.target.value })} />
          </div>
          <Button disabled={!examId || !item.medication || !item.dosage || !item.posology || !item.duration} onClick={() => void create()}>Enregistrer l'ordonnance</Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{row.patientName}</p>
                <Badge>{row.status === "draft" ? "Brouillon" : pharmacyStatusLabels[row.pharmacyStatus]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{row.prescriberName}</p>
              {row.items.map((line) => (
                <p key={line.id} className="text-sm">{line.medication} · {line.dosage} · {line.posology} · {line.duration} · {line.instructions}</p>
              ))}
              {row.status === "draft" && <Button size="sm" onClick={() => void publish(row.id)}>Valider et transmettre</Button>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
