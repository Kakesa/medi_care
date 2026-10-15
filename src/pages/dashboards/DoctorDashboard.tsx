import { useEffect, useState } from "react";
import { Calendar, Users, Stethoscope, Clock, Activity, FileText, Check, X } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { appointmentService } from "@/services/appointmentService";
import { consultationService } from "@/services/consultationService";
import { patientService } from "@/services/patientService";
import type { Appointment, Consultation, Patient } from "@/types";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    const load = async () => {
      const [appointmentResult, consultationResult, patientResult] = await Promise.allSettled([
        appointmentService.getAll({ limit: 100 }),
        consultationService.getAll({ limit: 100 }),
        patientService.getAll({ limit: 100 }),
      ]);
      if (appointmentResult.status === "fulfilled") setAppointments(appointmentResult.value.data);
      if (consultationResult.status === "fulfilled") setConsultations(consultationResult.value.data);
      if (patientResult.status === "fulfilled") setPatients(patientResult.value.data);
    };
    void load();
  }, []);

  const todayAppointments = appointments.filter((appointment) => appointment.date === todayIso() && appointment.status !== "cancelled");
  const pendingAppointments = appointments.filter((appointment) => appointment.status === "pending");
  const patientRequests = pendingAppointments.filter((appointment) => appointment.requestedBy === "patient");

  const respond = async (id: string, decision: "accept" | "decline") => {
    setRespondingId(id);
    try {
      const updated = decision === "accept"
        ? await appointmentService.accept(id)
        : await appointmentService.decline(id);
      setAppointments((current) => current.map((item) => item.id === id ? updated : item));
      window.dispatchEvent(new Event("notifications:refresh"));
      toast({ title: decision === "accept" ? "Demande acceptée" : "Demande refusée", description: "Le patient est informé." });
    } catch (error) {
      toast({ variant: "destructive", title: "Réponse impossible", description: apiMessage(error) });
    } finally {
      setRespondingId(null);
    }
  };
  const myConsultations = consultations;

  const stats = [
    {
      title: "RDV aujourd'hui",
      value: todayAppointments.length,
      change: `${pendingAppointments.length} en attente`,
      changeType: "neutral" as const,
      icon: Calendar,
      iconColor: "bg-primary/10 text-primary"
    },
    {
      title: "Mes patients",
      value: patients.length,
      change: "Patients suivis",
      changeType: "positive" as const,
      icon: Users,
      iconColor: "bg-info/10 text-info"
    },
    {
      title: "Consultations ce mois",
      value: myConsultations.length,
      change: "Dossiers enregistrés",
      changeType: "positive" as const,
      icon: Stethoscope,
      iconColor: "bg-success/10 text-success"
    },
    {
      title: "En cours",
      value: myConsultations.filter(c => c.status === 'in_progress').length,
      change: "Consultations actives",
      changeType: "neutral" as const,
      icon: Activity,
      iconColor: "bg-warning/10 text-warning"
    },
  ];

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
          Bonjour, Dr. {user?.lastName || 'Médecin'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Voici votre planning et activité du jour
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.title}
            {...stat}
            delay={index * 50}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's appointments */}
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Rendez-vous du jour
            </CardTitle>
            <div className="flex gap-2">
              <Link to="/dashboard/appointments">
                <Button size="sm">Planifier RDV</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayAppointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Aucun rendez-vous aujourd'hui
              </p>
            ) : (
              todayAppointments.slice(0, 5).map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{apt.patientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {apt.time} • {apt.duration} min
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(apt.status)}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent consultations */}
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Consultations récentes
            </CardTitle>
            <div className="flex gap-2">
              <Link to="/dashboard/consultations">
                <Button size="sm">Nouvelle consultation</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {myConsultations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Aucune consultation récente
              </p>
            ) : (
              myConsultations.slice(0, 5).map((cons) => (
                <div key={cons.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                      <FileText className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">{cons.patientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {cons.diagnosis}
                      </p>
                    </div>
                  </div>
                  <Badge variant={cons.status === 'completed' ? 'default' : 'secondary'}>
                    {cons.status === 'completed' ? 'Terminée' : 'En cours'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {patientRequests.length > 0 && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Demandes de patients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {patientRequests.map((appointment) => (
              <div key={appointment.id} className="flex flex-col items-start gap-3 rounded-lg bg-secondary/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{appointment.patientName}</p>
                  <p className="text-sm text-muted-foreground">{appointment.date} à {appointment.time}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void respond(appointment.id, "accept")} disabled={respondingId === appointment.id}>
                    <Check className="mr-1 h-4 w-4" />Accepter
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void respond(appointment.id, "decline")} disabled={respondingId === appointment.id}>
                    <X className="mr-1 h-4 w-4" />Refuser
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Patients to follow up */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Patients à suivre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {patients.slice(0, 6).map((patient) => {
              const lastConsultation = myConsultations.find(c => c.patientId === patient.id);
              return (
                <div key={patient.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                      {patient.firstName[0]}{patient.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                      <p className="text-xs text-muted-foreground">
                        Dernier: {lastConsultation?.date || "—"}
                      </p>
                    </div>
                  </div>
                  {lastConsultation?.followUpDate && (
                    <p className="mt-2 text-xs text-warning">
                      Suivi prévu: {lastConsultation.followUpDate}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}