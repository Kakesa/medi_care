import { useEffect, useState } from "react";
import { FileDown, HeartPulse, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { nursingService } from "@/services/nursingService";
import type { TreatmentRecordFile } from "@/types/nursing";
import { downloadTreatmentRecord, printTreatmentRecord } from "@/utils/treatmentRecord";

function period(start?: string, end?: string) {
  const label = (value?: string) => value
    ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00.000Z`))
    : "—";
  return `${label(start)} – ${label(end)}`;
}

export default function PatientTreatments() {
  const { toast } = useToast();
  const [file, setFile] = useState<TreatmentRecordFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setFile(await nursingService.getTreatmentRecords());
      } catch (error) {
        toast({ variant: "destructive", title: "Fiches indisponibles", description: apiMessage(error) });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [toast]);

  const open = (mode: "print" | "pdf") => {
    if (!file?.treatments.length) return;
    if (mode === "pdf") {
      downloadTreatmentRecord(file);
      return;
    }
    setBusy(true);
    if (!printTreatmentRecord(file)) {
      toast({ variant: "destructive", title: "Impression bloquée", description: "Autorisez les fenêtres du navigateur, ou téléchargez le PDF." });
    }
    setBusy(false);
  };

  const treatments = file?.treatments ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Traitements</h1>
        <p className="mt-1 text-muted-foreground">Imprimez ou téléchargez l’ensemble des traitements et leur déroulement.</p>
        {treatments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => open("print")}>
              <Printer className="mr-2 h-4 w-4" />Imprimer
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => open("pdf")}>
              <FileDown className="mr-2 h-4 w-4" />PDF
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement des fiches...</p>
      ) : treatments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <HeartPulse className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun traitement enregistré</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {treatments.map((course) => {
            const done = course.doses.filter((dose) => dose.status === "administered_on_time" || dose.status === "administered_late").length;
            return (
              <Card key={course.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{course.medication}</p>
                      <p className="text-sm text-muted-foreground">{course.dosage} · {course.route || "Voie non renseignée"}</p>
                    </div>
                    <Badge variant={course.outcome === "interrupted" ? "destructive" : "default"}>
                      {course.outcome === "interrupted" ? "Interrompu" : "Terminé"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{period(course.startDate, course.endDate)} · {course.prescriberName}</p>
                  <p className="text-sm text-muted-foreground">{done} prise(s) effectuée(s) sur {course.doses.length}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
