import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { organizationService, type OrganizationProfile, type OrganizationStatus } from "@/services/organizationService";

const statusLabels: Record<OrganizationStatus, string> = {
  pending: "En attente",
  active: "Actif",
  suspended: "Suspendu",
  rejected: "Refusé",
};

const facilityLabels: Record<string, string> = {
  hopital: "Hôpital",
  clinique: "Clinique",
  centre_sante: "Centre de santé",
  polyclinique: "Polyclinique",
  autre: "Autre",
};

function when(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function HospitalDetail() {
  const { hospitalId = "" } = useParams();
  const { toast } = useToast();
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    try {
      setProfile(await organizationService.profile(hospitalId));
    } catch (caught) {
      setError(apiMessage(caught));
    }
  };

  useEffect(() => { void load(); }, [hospitalId]);

  const decide = async (decision: "approve" | "reject") => {
    try {
      await organizationService.decide(hospitalId, decision, reason);
      setReason("");
      toast({ title: decision === "approve" ? "Établissement activé" : "Demande refusée" });
      await load();
    } catch (caught) {
      toast({ variant: "destructive", title: "Décision impossible", description: apiMessage(caught) });
    }
  };

  const org = profile?.organization;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Button variant="ghost" className="-ml-2 h-8 px-2" asChild><Link to="/dashboard/hospitals"><ArrowLeft className="mr-1.5 h-4 w-4" />Centres</Link></Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!org && !error && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {org && profile && (
        <>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {org.coverImage && <img src={org.coverImage} alt="" className="h-28 w-full object-cover" />}
            <div className="flex items-center gap-3 p-4">
              {org.logo ? <img src={org.logo} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">{org.name.slice(0, 2).toUpperCase()}</span>}
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold">{org.name}</h1>
                <p className="text-sm text-muted-foreground">{statusLabels[org.status]} · {facilityLabels[org.facilityType || ""] || org.facilityType || "Établissement"} · {org.location || org.address}</p>
              </div>
            </div>
          </div>

          {org.status === "pending" && (
            <div className="space-y-2 rounded-2xl border bg-card p-4">
              <p className="text-sm font-medium">Cette demande attend une décision.</p>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motif en cas de refus" maxLength={1000} />
              <div className="flex gap-2">
                <Button onClick={() => void decide("approve")}>Valider</Button>
                <Button variant="outline" onClick={() => void decide("reject")}>Refuser</Button>
              </div>
            </div>
          )}
          {org.status === "rejected" && org.rejectionReason && <p className="rounded-xl border border-destructive/30 px-3 py-2 text-sm">Motif du refus : {org.rejectionReason}</p>}

          <Tabs defaultValue="overview">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1">
              <TabsTrigger className="w-full" value="overview">Vue d’ensemble</TabsTrigger>
              <TabsTrigger className="w-full" value="admins">Administrateurs</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="grid gap-2 sm:grid-cols-2">
              {[
                ["Nom", org.name],
                ["Enregistrement", org.registrationNumber],
                ["Adresse", org.address],
                ["Localisation", org.location],
                ["Téléphone", org.phone],
                ["Email", org.email],
                ["Devise", org.currency],
                ["Fuseau", org.timezone],
                ["Inscription", when(org.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium">{value || "—"}</p>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="admins" className="space-y-2">
              {profile.admins.length === 0 && <p className="text-sm text-muted-foreground">Aucun administrateur.</p>}
              {profile.admins.map((admin) => (
                <div key={admin.id} className="rounded-xl border px-3 py-2 text-sm">
                  <p className="font-medium">{admin.fullName}</p>
                  <p className="text-muted-foreground">{admin.jobTitle || "Administrateur"} · {admin.email} · {admin.phone || "—"}</p>
                  <p className="text-xs">{admin.isActive ? "Compte actif" : "Compte en attente d’activation"}</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
