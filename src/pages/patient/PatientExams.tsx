import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { useAckExamResults } from "@/contexts/WorkBadgeContext";
import { examService } from "@/services/examService";
import type { Exam, ExamStatus, ExamType } from "@/types";

const typeLabels: Record<ExamType, string> = {
  laboratory: "Laboratoire",
  imaging: "Imagerie",
  biopsy: "Biopsie",
  other: "Autre",
};

const statusLabels: Record<ExamStatus, string> = {
  pending: "En attente",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
};

export default function PatientExams() {
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  useAckExamResults(exams.flatMap((exam) => (exam.results ? [exam.id] : [])));

  useEffect(() => {
    const load = async () => {
      try {
        const result = await examService.getAll({ limit: 100 });
        setExams(result.data);
      } catch (error) {
        toast({ variant: "destructive", title: "Examens indisponibles", description: apiMessage(error) });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Examen</h1>
        <p className="mt-1 text-muted-foreground">Les examens recommandés pour vous et leurs résultats.</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement des examens...</p>
      ) : exams.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="py-12 text-center">
            <FlaskConical className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun examen enregistré</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {exams.map((exam) => (
            <Card key={exam.id} className="card-elevated">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge variant={exam.status === "completed" ? "default" : exam.status === "cancelled" ? "destructive" : "secondary"}>
                    {statusLabels[exam.status]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{exam.date}</span>
                </div>
                <p className="font-medium">{exam.name}</p>
                <p className="text-sm text-muted-foreground">{typeLabels[exam.type]} · {exam.category}</p>
                <p className="mt-1 text-sm text-muted-foreground">{exam.doctorName}</p>
                {exam.results && (
                  <div className="mt-3 rounded-lg bg-success/10 p-3">
                    <p className="text-xs font-medium text-success">Résultats</p>
                    <p className="text-sm text-muted-foreground">{exam.results}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
