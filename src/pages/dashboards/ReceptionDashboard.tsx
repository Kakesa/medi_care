import { UserPlus, Clock, Users, CheckCircle, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockReception, mockAppointments } from "@/data/mockData";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ReceptionDashboard() {
  const { user } = useAuth();
  
  const waitingPatients = mockReception.filter(r => r.status === 'waiting');
  const inConsultation = mockReception.filter(r => r.status === 'in_consultation');
  const completedToday = mockReception.filter(r => r.status === 'completed');
  const todayAppointments = mockAppointments.filter(a => a.status === 'confirmed');

  const stats = [
    {
      title: "En attente",
      value: waitingPatients.length,
      change: "Patients dans la file",
      changeType: waitingPatients.length > 5 ? "negative" as const : "neutral" as const,
      icon: Clock,
      iconColor: "bg-warning/10 text-warning"
    },
    {
      title: "En consultation",
      value: inConsultation.length,
      change: "Actuellement",
      changeType: "neutral" as const,
      icon: Users,
      iconColor: "bg-primary/10 text-primary"
    },
    {
      title: "RDV aujourd'hui",
      value: todayAppointments.length,
      change: "Confirmés",
      changeType: "positive" as const,
      icon: CheckCircle,
      iconColor: "bg-success/10 text-success"
    },
    {
      title: "Traités aujourd'hui",
      value: completedToday.length,
      change: "Patients",
      changeType: "positive" as const,
      icon: UserPlus,
      iconColor: "bg-info/10 text-info"
    },
  ];

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      urgent: { variant: "destructive", label: "Urgent" },
      high: { variant: "destructive", label: "Haute" },
      medium: { variant: "secondary", label: "Moyenne" },
      low: { variant: "outline", label: "Basse" }
    };
    const { variant, label } = variants[priority] || { variant: "outline", label: priority };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      waiting: { variant: "secondary", label: "En attente" },
      in_consultation: { variant: "default", label: "En consultation" },
      completed: { variant: "outline", label: "Terminé" },
      cancelled: { variant: "destructive", label: "Annulé" }
    };
    const { variant, label } = variants[status] || { variant: "outline", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground">
          Accueil & Réception
        </h1>
        <p className="mt-1 text-muted-foreground">
          Bonjour {user?.firstName}, gérez les arrivées et la file d'attente
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
        {/* Waiting queue */}
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              File d'attente
            </CardTitle>
            <div className="flex gap-2">
              <Link to="/dashboard/appointments">
                <Button variant="outline" size="sm">Planifier RDV</Button>
              </Link>
              <Link to="/dashboard/reception">
                <Button size="sm">Gérer</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {waitingPatients.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Aucun patient en attente
              </p>
            ) : (
              waitingPatients.map((entry, index) => (
                <div 
                  key={entry.id} 
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    entry.priority === 'urgent' ? 'bg-destructive/10 border border-destructive/20' : 'bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{entry.patientName}</p>
                      <p className="text-sm text-muted-foreground">
                        Arrivé à {entry.arrivalTime} • {entry.reason}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(entry.priority)}
                    {entry.priority === 'urgent' && (
                      <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Today's appointments */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              RDV confirmés aujourd'hui
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayAppointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Aucun rendez-vous confirmé
              </p>
            ) : (
              todayAppointments.slice(0, 6).map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="font-medium">{apt.patientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {apt.time} • {apt.doctorName}
                    </p>
                  </div>
                  <Badge variant="outline">{apt.type}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Activité du jour
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockReception.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{entry.patientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.arrivalTime} • {entry.reason}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(entry.priority)}
                  {getStatusBadge(entry.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}