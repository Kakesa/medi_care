import { useEffect, useState } from "react";
import { Building2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { organizationService, type OrganizationRecord } from "@/services/organizationService";
import type { ApiError } from "@/types";

export default function SuperAdminDashboard() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    organizationService.list()
      .then((response) => {
        if (active) setOrganizations(response.data);
      })
      .catch((reason: ApiError) => {
        if (active) setError(reason.message || "Impossible de charger les établissements");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeCount = organizations.filter((org) => org.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plateforme MediCare</h1>
          <p className="mt-1 text-muted-foreground">Supervision des établissements. Les dossiers médicaux restent dans chaque hôpital.</p>
        </div>
        <Button asChild variant="hero">
          <Link to="/dashboard/hospitals">Gérer les hôpitaux</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 sm:grid-cols-2">
        <StatCard title="Établissements" value={isLoading ? "…" : organizations.length} icon={Building2} />
        <StatCard title="Établissements actifs" value={isLoading ? "…" : activeCount} icon={ShieldAlert} iconColor="bg-success/10 text-success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Derniers établissements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
          {!isLoading && organizations.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun établissement pour le moment.</p>
          )}
          {organizations.slice(0, 5).map((org) => (
            <div key={org.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
              <div>
                <p className="font-medium">{org.name}</p>
                <p className="text-sm text-muted-foreground">{org.slug}</p>
              </div>
              <p className="text-sm text-muted-foreground">{org.status === "active" ? "Actif" : "Suspendu"}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
