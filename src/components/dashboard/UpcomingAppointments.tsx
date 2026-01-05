import { Calendar, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const appointments = [
  {
    id: 1,
    patient: "Jean Martin",
    doctor: "Dr. Sophie Bernard",
    time: "09:00",
    type: "Consultation",
    status: "confirmed"
  },
  {
    id: 2,
    patient: "Claire Dubois",
    doctor: "Dr. Pierre Leroy",
    time: "10:30",
    type: "Suivi",
    status: "pending"
  },
  {
    id: 3,
    patient: "Michel Petit",
    doctor: "Dr. Sophie Bernard",
    time: "11:00",
    type: "Examen",
    status: "confirmed"
  },
  {
    id: 4,
    patient: "Anne Richard",
    doctor: "Dr. Marc Duval",
    time: "14:30",
    type: "Consultation",
    status: "confirmed"
  },
];

const statusColors = {
  confirmed: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20"
};

const statusLabels = {
  confirmed: "Confirmé",
  pending: "En attente",
  cancelled: "Annulé"
};

export function UpcomingAppointments() {
  return (
    <div className="rounded-xl bg-card border border-border p-6 animate-slide-up" style={{ animationDelay: "300ms" }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Rendez-vous du jour</h3>
        <Button variant="outline" size="sm">
          <Calendar className="h-4 w-4 mr-2" />
          Voir tout
        </Button>
      </div>
      
      <div className="space-y-4">
        {appointments.map((apt, index) => (
          <div 
            key={apt.id}
            className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 transition-colors hover:bg-secondary animate-fade-in"
            style={{ animationDelay: `${400 + index * 100}ms` }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{apt.patient}</p>
                <Badge variant="outline" className={statusColors[apt.status as keyof typeof statusColors]}>
                  {statusLabels[apt.status as keyof typeof statusLabels]}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {apt.doctor}
                </span>
                <span>{apt.type}</span>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-lg font-semibold text-foreground">{apt.time}</p>
              <p className="text-xs text-muted-foreground">Aujourd'hui</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}