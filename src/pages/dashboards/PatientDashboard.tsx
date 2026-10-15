import { useEffect, useState } from "react";
import { Calendar, FileText, FlaskConical, Pill, User, Clock, AlertCircle, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { appointmentService } from "@/services/appointmentService";
import { consultationService } from "@/services/consultationService";
import { examService } from "@/services/examService";
import type { Appointment, Consultation, Exam } from "@/types";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";

export default function PatientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    const load = async () => {
      const [appointmentResult, consultationResult, examResult] = await Promise.allSettled([
        appointmentService.getAll({ limit: 100 }),
        consultationService.getAll({ limit: 100 }),
        examService.getAll({ limit: 100 }),
      ]);
      if (appointmentResult.status === "fulfilled") setAppointments(appointmentResult.value.data);
      if (consultationResult.status === "fulfilled") setConsultations(consultationResult.value.data);
      if (examResult.status === "fulfilled") setExams(examResult.value.data);
    };
    void load();
  }, []);

  const respond = async (id: string, decision: "accept" | "decline") => {
    setRespondingId(id);
    try {
      const updated = decision === "accept"
        ? await appointmentService.accept(id)
        : await appointmentService.decline(id);
      setAppointments((current) => current.map((item) => item.id === id ? updated : item));
      window.dispatchEvent(new Event("notifications:refresh"));
      toast({
        title: decision === "accept" ? "Rendez-vous accepté" : "Rendez-vous refusé",
        description: decision === "accept" ? "Le médecin est informé." : "Le médecin est informé de votre refus.",
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Réponse impossible", description: apiMessage(error) });
    } finally {
      setRespondingId(null);
    }
  };

  const myAppointments = appointments;
  const myConsultations = consultations;
  const myExams = exams;
  
  const upcomingAppointments = myAppointments.filter(a => a.status === 'confirmed' || a.status === 'pending');
  const completedConsultations = myConsultations.filter(c => c.status === 'completed');

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      confirmed: { variant: "default", label: "Confirmé" },
      pending: { variant: "secondary", label: "En attente" },
      cancelled: { variant: "destructive", label: "Annulé" },
      completed: { variant: "outline", label: "Terminé" }
    };
    const { variant, label } = variants[status] || { variant: "outline", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground">
          Bienvenue, {user?.firstName || 'Patient'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Suivez votre parcours de santé et vos rendez-vous
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingAppointments.length}</p>
                <p className="text-sm text-muted-foreground">RDV à venir</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <FileText className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedConsultations.length}</p>
                <p className="text-sm text-muted-foreground">Consultations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
                <FlaskConical className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{myExams.length}</p>
                <p className="text-sm text-muted-foreground">Examens</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <Pill className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {myConsultations.filter(c => c.prescription).length}
                </p>
                <p className="text-sm text-muted-foreground">Ordonnances</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming appointments */}
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Mes rendez-vous
            </CardTitle>
            <Link to="/">
              <Button variant="outline" size="sm">Demander RDV</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingAppointments.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Aucun rendez-vous prévu</p>
                <Link to="/">
                  <Button className="mt-4" size="sm">Prendre rendez-vous</Button>
                </Link>
              </div>
            ) : (
              upcomingAppointments.map((apt) => (
                <div key={apt.id} className="flex flex-col items-start gap-3 rounded-lg bg-secondary/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{apt.doctorName}</p>
                      <p className="text-sm text-muted-foreground">
                        {apt.date} à {apt.time}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {apt.type === 'consultation' ? 'Consultation' : 
                         apt.type === 'followup' ? 'Suivi' : 
                         apt.type === 'exam' ? 'Examen' : 'Urgence'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(apt.status)}
                    {apt.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => void respond(apt.id, "accept")} disabled={respondingId === apt.id}>
                          <Check className="mr-1 h-4 w-4" />Accepter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void respond(apt.id, "decline")} disabled={respondingId === apt.id}>
                          <X className="mr-1 h-4 w-4" />Refuser
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Medical history */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Historique médical
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {completedConsultations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Aucun historique disponible
              </p>
            ) : (
              completedConsultations.map((cons) => (
                <div key={cons.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{cons.doctorName}</p>
                    <span className="text-sm text-muted-foreground">{cons.date}</span>
                  </div>
                  <p className="text-sm font-medium text-primary">{cons.diagnosis}</p>
                  <p className="text-sm text-muted-foreground mt-1">{cons.treatment}</p>
                  {cons.prescription && (
                    <div className="mt-2 p-2 rounded bg-secondary/50">
                      <p className="text-xs font-medium flex items-center gap-1">
                        <Pill className="h-3 w-3" /> Ordonnance
                      </p>
                      <p className="text-xs text-muted-foreground">{cons.prescription}</p>
                    </div>
                  )}
                  {cons.followUpDate && (
                    <p className="text-xs text-warning mt-2 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Suivi prévu: {cons.followUpDate}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Exam results */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Résultats d'examens
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myExams.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Aucun examen enregistré
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {myExams.map((exam) => (
                <div key={exam.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={exam.status === 'completed' ? 'default' : 'secondary'}>
                      {exam.status === 'completed' ? 'Terminé' : 
                       exam.status === 'pending' ? 'En attente' : 'En cours'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{exam.date}</span>
                  </div>
                  <p className="font-medium">{exam.name}</p>
                  <p className="text-sm text-muted-foreground">{exam.category}</p>
                  {exam.results && (
                    <div className="mt-2 p-2 rounded bg-success/10">
                      <p className="text-xs font-medium text-success">Résultats</p>
                      <p className="text-xs text-muted-foreground">{exam.results}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile card */}
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Mon profil
          </CardTitle>
          <Link to="/dashboard/profile">
            <Button variant="outline" size="sm">Modifier</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-semibold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <p className="text-lg font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-sm text-muted-foreground">{user?.phone}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}