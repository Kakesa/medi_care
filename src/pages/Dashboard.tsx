import { Users, UserCircle, Calendar, Activity, TrendingUp, Bed } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";

const stats = [
  {
    title: "Personnel actif",
    value: 127,
    change: "+12% ce mois",
    changeType: "positive" as const,
    icon: Users,
    iconColor: "bg-primary/10 text-primary"
  },
  {
    title: "Patients enregistrés",
    value: 2847,
    change: "+8% ce mois",
    changeType: "positive" as const,
    icon: UserCircle,
    iconColor: "bg-info/10 text-info"
  },
  {
    title: "RDV aujourd'hui",
    value: 48,
    change: "12 en attente",
    changeType: "neutral" as const,
    icon: Calendar,
    iconColor: "bg-warning/10 text-warning"
  },
  {
    title: "Consultations",
    value: 156,
    change: "+24% cette semaine",
    changeType: "positive" as const,
    icon: Activity,
    iconColor: "bg-success/10 text-success"
  },
  {
    title: "Taux d'occupation",
    value: "87%",
    change: "+5% vs hier",
    changeType: "positive" as const,
    icon: TrendingUp,
    iconColor: "bg-accent/10 text-accent"
  },
  {
    title: "Lits disponibles",
    value: 23,
    change: "sur 180",
    changeType: "neutral" as const,
    icon: Bed,
    iconColor: "bg-muted text-muted-foreground"
  },
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="mt-1 text-muted-foreground">
          Vue d'ensemble de l'activité hospitalière
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.title}
            {...stat}
            delay={index * 50}
          />
        ))}
      </div>

      {/* Activity and appointments */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity />
        <UpcomingAppointments />
      </div>
    </div>
  );
}