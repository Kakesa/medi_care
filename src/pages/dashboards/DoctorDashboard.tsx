import { Calendar, Users, Stethoscope, Clock, Activity, FileText } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { mockAppointments, mockConsultations, mockPatients } from "@/data/mockData";
import { Link } from "react-router-dom";

export default function DoctorDashboard() {
  const { user } = useAuth();
  
  // Filter data for current doctor (using mock doctor id for demo)
  const doctorId = "pers-1"; // In real app, this would come from user profile
  
  const myAppointments = mockAppointments.filter(a => a.doctorId === doctorId);
  const myConsultations = mockConsultations.filter(c => c.doctorId === doctorId);
  const todayAppointments = myAppointments.filter(a => a.status !== 'cancelled');
  const pendingAppointments = myAppointments.filter(a => a.status === 'pending');
  const myPatients = [...new Set(myConsultations.map(c => c.patientId))];

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
      value: myPatients.length,
      change: "Patients suivis",
      changeType: "positive" as const,
      icon: Users,
      iconColor: "bg-info/10 text-info"
    },
    {
      title: "Consultations ce mois",
      value: myConsultations.length,
      change: "+15% vs mois dernier",
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
            {myPatients.slice(0, 6).map((patientId) => {
              const patient = mockPatients.find(p => p.id === patientId);
              const lastConsultation = myConsultations.find(c => c.patientId === patientId);
              if (!patient) return null;
              
              return (
                <div key={patientId} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                      {patient.firstName[0]}{patient.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                      <p className="text-xs text-muted-foreground">
                        Dernier: {lastConsultation?.date}
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