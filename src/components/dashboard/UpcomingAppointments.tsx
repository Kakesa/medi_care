import { useEffect, useState } from "react";
import { Calendar, Clock, User } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { appointmentService } from "@/services/appointmentService";
import type { Appointment } from "@/types";

const statusColors: Record<string, string> = {
  confirmed: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmé",
  pending: "En attente",
  completed: "Terminé",
  cancelled: "Annulé",
};

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function UpcomingAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    appointmentService.getByDate(todayIso()).then(setAppointments).catch(() => setAppointments([]));
  }, []);

  return (
    <div className="rounded-xl bg-card border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Rendez-vous du jour</h3>
        <Button variant="outline" size="sm" asChild>
          <Link to="/dashboard/appointments">
            <Calendar className="h-4 w-4 mr-2" />
            Voir tout
          </Link>
        </Button>
      </div>

      {appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun rendez-vous aujourd'hui</p>
      ) : (
        <div className="space-y-4">
          {appointments.slice(0, 6).map((appointment) => (
            <div key={appointment.id} className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{appointment.patientName}</p>
                  <Badge variant="outline" className={statusColors[appointment.status]}>{statusLabels[appointment.status]}</Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{appointment.doctorName}</span>
                  <span>{appointment.type}</span>
                </div>
              </div>
              <p className="text-lg font-semibold text-foreground">{appointment.time}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
