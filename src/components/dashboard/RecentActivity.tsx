import { Clock } from "lucide-react";

export function RecentActivity() {
  return (
    <div className="rounded-xl bg-card border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Activité récente</h3>
        <Clock className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">
        Le journal d'activité détaillé n'est pas encore affiché ici. Les dossiers cliniques sont disponibles dans leurs modules.
      </p>
    </div>
  );
}
