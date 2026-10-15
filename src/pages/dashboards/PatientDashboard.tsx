import { useEffect, useRef, useState } from "react";
import { Calendar, FileText, FlaskConical, Pill, User, Clock, AlertCircle, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { appointmentService } from "@/services/appointmentService";
import { consultationService } from "@/services/consultationService";
import { examService } from "@/services/examService";
import { personnelService } from "@/services/personnelService";
import type { Appointment, AppointmentType, Consultation, Exam, Personnel } from "@/types";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";

const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function PatientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [doctors, setDoctors] = useState<Personnel[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const requestingRef = useRef(false);
  const [requestForm, setRequestForm] = useState({
    doctorId: "",
    date: todayIso(),
    time: "09:00",
    duration: "30",
    type: "consultation" as AppointmentType,
    notes: "",
  });

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

  const openRequest = async () => {
    setRequestOpen(true);
    if (doctors.length > 0) return;
    try {
      setDoctors(await personnelService.getDoctors());
    } catch (error) {
      toast({ variant: "destructive", title: "Médecins indisponibles", description: apiMessage(error) });
    }
  };

  const requestAppointment = async () => {
    if (requestingRef.current) return;
    if (!requestForm.doctorId) {
      toast({ variant: "destructive", title: "Médecin requis", description: "Choisissez un médecin." });
      return;
    }
    requestingRef.current = true;
    setRequesting(true);
    try {
      const created = await appointmentService.request({
        doctorId: requestForm.doctorId,
        date: requestForm.date,
        time: requestForm.time,
        duration: Number(requestForm.duration),
        type: requestForm.type,
        notes: requestForm.notes || undefined,
      });
      setAppointments((current) => [created, ...current]);
      setRequestOpen(false);
      window.dispatchEvent(new Event("notifications:refresh"));
      toast({ title: "Demande envoyée", description: "Le médecin est prévenu et peut accepter le rendez-vous." });
    } catch (error) {
      toast({ variant: "destructive", title: "Demande impossible", description: apiMessage(error) });
    } finally {
      requestingRef.current = false;
      setRequesting(false);
    }
  };

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
            <Button variant="outline" size="sm" onClick={() => openRequest()}>Demander un rendez-vous</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingAppointments.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Aucun rendez-vous prévu</p>
                <Button className="mt-4" size="sm" onClick={() => openRequest()}>Prendre rendez-vous</Button>
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
                    {apt.status === "pending" && apt.requestedBy !== "patient" && (
                      <>
                        <Button size="sm" onClick={() => respond(apt.id, "accept")} disabled={respondingId === apt.id}>
                          <Check className="mr-1 h-4 w-4" />Accepter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => respond(apt.id, "decline")} disabled={respondingId === apt.id}>
                          <X className="mr-1 h-4 w-4" />Refuser
                        </Button>
                      </>
                    )}
                    {apt.status === "pending" && apt.requestedBy === "patient" && (
                      <Button size="sm" variant="outline" onClick={() => respond(apt.id, "decline")} disabled={respondingId === apt.id}>
                        Annuler
                      </Button>
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

      <Dialog open={requestOpen} onOpenChange={(next) => { if (!requestingRef.current) setRequestOpen(next); }}>
        <DialogContent
          className="flex max-w-lg flex-col gap-0 overflow-hidden p-0 sm:p-0"
          onEscapeKeyDown={(event) => { if (requesting) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (requesting) event.preventDefault(); }}
        >
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>Demander un rendez-vous</DialogTitle>
            <DialogDescription>Le médecin reçoit votre demande et la confirme.</DialogDescription>
          </DialogHeader>
          <fieldset disabled={requesting} className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <Label>Médecin</Label>
              <Select value={requestForm.doctorId} onValueChange={(doctorId) => setRequestForm({ ...requestForm, doctorId })} disabled={requesting}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un médecin" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>Dr. {doctor.firstName} {doctor.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {doctors.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun médecin enregistré dans votre établissement.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={requestForm.date} onChange={(event) => setRequestForm({ ...requestForm, date: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Heure</Label>
                <Select value={requestForm.time} onValueChange={(time) => setRequestForm({ ...requestForm, time })} disabled={requesting}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Durée (min)</Label>
                <Input type="number" min={5} value={requestForm.duration} onChange={(event) => setRequestForm({ ...requestForm, duration: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={requestForm.type} onValueChange={(type) => setRequestForm({ ...requestForm, type: type as AppointmentType })} disabled={requesting}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="followup">Suivi</SelectItem>
                    <SelectItem value="exam">Examen</SelectItem>
                    <SelectItem value="emergency">Urgence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motif</Label>
              <Textarea value={requestForm.notes} placeholder="Décrivez brièvement le motif" onChange={(event) => setRequestForm({ ...requestForm, notes: event.target.value })} />
            </div>
          </fieldset>
          <div className="shrink-0 border-t bg-background px-5 py-4">
            <Button className="w-full disabled:opacity-100" variant="hero" size="lg" type="button" disabled={requesting} onClick={() => requestAppointment()}>
              {requesting ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi...</> : "Envoyer la demande"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}