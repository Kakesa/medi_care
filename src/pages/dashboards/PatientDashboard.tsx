import { Calendar, FileText, FlaskConical, Pill, User, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { mockAppointments, mockConsultations, mockExams } from "@/data/mockData";
import { Link } from "react-router-dom";

export default function PatientDashboard() {
  const { user } = useAuth();
  
  // Filter data for current patient (using mock patient id for demo)
  const patientId = "pat-2"; // In real app, this would come from user profile
  
  const myAppointments = mockAppointments.filter(a => a.patientId === patientId);
  const myConsultations = mockConsultations.filter(c => c.patientId === patientId);
  const myExams = mockExams.filter(e => e.patientId === patientId);
  
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
                <div key={apt.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
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
                  {getStatusBadge(apt.status)}
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