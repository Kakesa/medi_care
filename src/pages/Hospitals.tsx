import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { organizationService, type OrganizationRecord, type OrganizationStatus } from "@/services/organizationService";
import { userAdminService } from "@/services/userAdminService";
import type { ApiError } from "@/types";

const statusLabels: Record<OrganizationStatus, string> = {
  pending: "En attente",
  active: "Actif",
  suspended: "Suspendu",
  rejected: "Refusé",
};

const emptyHospital = { name: "", slug: "", address: "", phone: "", email: "" };
const emptyAdmin = { firstName: "", lastName: "", email: "" };

export default function Hospitals() {
  const { toast } = useToast();
  const [hospitals, setHospitals] = useState<OrganizationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyHospital);
  const [adminFor, setAdminFor] = useState<OrganizationRecord | null>(null);
  const [adminForm, setAdminForm] = useState(emptyAdmin);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrganizationStatus | "">("");

  const load = async (term = search, selected = status) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await organizationService.list({
        ...(term.trim() ? { search: term.trim() } : {}),
        ...(selected ? { status: selected } : {}),
      });
      setHospitals(response.data);
    } catch (reason) {
      setError((reason as ApiError).message || "Chargement impossible");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createHospital = async () => {
    try {
      await organizationService.create({
        ...form,
        slug: form.slug.trim().toLowerCase(),
      });
      setIsOpen(false);
      setForm(emptyHospital);
      toast({ title: "Établissement créé" });
      await load();
    } catch (reason) {
      toast({ variant: "destructive", title: "Création impossible", description: (reason as ApiError).message });
    }
  };

  const toggleStatus = async (hospital: OrganizationRecord) => {
    try {
      await organizationService.update(hospital.id, {
        status: hospital.status === "active" ? "suspended" : "active",
      });
      await load();
    } catch (reason) {
      toast({ variant: "destructive", title: "Mise à jour impossible", description: (reason as ApiError).message });
    }
  };

  const createAdmin = async () => {
    if (!adminFor) return;
    try {
      await userAdminService.createForOrganization(adminFor.id, {
        ...adminForm,
        role: "HOSPITAL_ADMIN",
      });
      setAdminFor(null);
      setAdminForm(emptyAdmin);
      toast({
        title: "Administrateur créé",
        description: "Un mot de passe temporaire a été envoyé par e-mail. Il devra le changer à la première connexion.",
      });
      await load();
    } catch (reason) {
      toast({ variant: "destructive", title: "Création impossible", description: (reason as ApiError).message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold md:text-3xl">Centres hospitaliers</h1>
          <p className="mt-1 hidden text-muted-foreground md:block">Inscriptions, administrateurs et statut de chaque établissement.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="hero"><Plus className="mr-2 h-4 w-4" />Nouvel établissement</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un établissement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Identifiant unique</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="clinique-nord" /></div>
              <div className="space-y-2"><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-2"><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <Button className="w-full" onClick={() => createHospital()}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Nom, ville, adresse ou email" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as OrganizationStatus | "")}>
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="rejected">Refusés</option>
        </select>
        <Button variant="outline" onClick={() => void load()}>Filtrer</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Centre</th>
              <th className="px-3 py-2 font-medium">Administrateur</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Adresse</th>
              <th className="px-3 py-2 font-medium">Inscription</th>
              <th className="px-3 py-2 font-medium">Statut</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {hospitals.map((hospital) => (
              <tr key={hospital.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {hospital.logo ? <img src={hospital.logo} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{hospital.name.slice(0, 2).toUpperCase()}</span>}
                    <span className="font-medium">{hospital.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2">{hospital.admin?.fullName || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{hospital.admin?.email || hospital.email}<br />{hospital.admin?.phone || hospital.phone}</td>
                <td className="px-3 py-2 text-muted-foreground">{hospital.address}{hospital.location ? ` · ${hospital.location}` : ""}</td>
                <td className="px-3 py-2">{hospital.createdAt ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(hospital.createdAt)) : "—"}</td>
                <td className="px-3 py-2">{statusLabels[hospital.status]}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild><Link to={`/dashboard/hospitals/${hospital.id}`}>Ouvrir</Link></Button>
                    {(hospital.status === "active" || hospital.status === "suspended") && (
                      <Button variant="outline" size="sm" onClick={() => void toggleStatus(hospital)}>{hospital.status === "active" ? "Suspendre" : "Réactiver"}</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && hospitals.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Aucun établissement.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!adminFor} onOpenChange={(open) => !open && setAdminFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Administrateur de {adminFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Prénom</Label><Input value={adminForm.firstName} onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Nom</Label><Input value={adminForm.lastName} onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} /></div>
            <p className="text-sm text-muted-foreground">Un mot de passe temporaire sera envoyé à cet e-mail. L'administrateur devra le changer à sa première connexion.</p>
            <Button className="w-full" onClick={() => createAdmin()}>Créer le compte</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
