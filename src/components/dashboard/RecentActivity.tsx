import { 
  UserPlus, 
  Calendar, 
  FileCheck, 
  Stethoscope,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

const activities = [
  {
    id: 1,
    type: "patient",
    message: "Nouveau patient enregistré: Marie Dupont",
    time: "Il y a 5 min",
    icon: UserPlus,
    iconColor: "bg-success/10 text-success"
  },
  {
    id: 2,
    type: "appointment",
    message: "RDV confirmé avec Dr. Martin - 14h00",
    time: "Il y a 15 min",
    icon: Calendar,
    iconColor: "bg-info/10 text-info"
  },
  {
    id: 3,
    type: "exam",
    message: "Résultats d'analyse disponibles - Patient #1234",
    time: "Il y a 30 min",
    icon: FileCheck,
    iconColor: "bg-warning/10 text-warning"
  },
  {
    id: 4,
    type: "consultation",
    message: "Consultation terminée - Dr. Bernard",
    time: "Il y a 1h",
    icon: Stethoscope,
    iconColor: "bg-primary/10 text-primary"
  },
];

export function RecentActivity() {
  return (
    <div className="rounded-xl bg-card border border-border p-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Activité récente</h3>
        <Clock className="h-5 w-5 text-muted-foreground" />
      </div>
      
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div 
            key={activity.id} 
            className="flex items-start gap-4 animate-fade-in"
            style={{ animationDelay: `${300 + index * 100}ms` }}
          >
            <div className={cn("rounded-lg p-2", activity.iconColor)}>
              <activity.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{activity.message}</p>
              <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}