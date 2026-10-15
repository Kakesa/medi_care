import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { organizationService, type OrganizationRecord } from "@/services/organizationService";
import { userAdminService } from "@/services/userAdminService";
import type { ApiError } from "@/types";

const emptyHospital = { name: "", slug: "", address: "", phone: "", email: "" };
const emptyAdmin = { firstName: "", lastName: "", email: "", password: "" };

export default function Hospitals() {
  const { toast } = useToast();
  const [hospitals, setHospitals] = useState<OrganizationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyHospital);
  const [adminFor, setAdminFor] = useState<OrganizationRecord | null>(null);
  const [adminForm, setAdminForm] = useState(emptyAdmin);

  const load = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await organizationService.list();
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
      toast({ title: "Administrateur créé" });
      await load();
    } catch (reason) {
      toast({ variant: "destructive", title: "Création impossible", description: (reason as ApiError).message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hôpitaux</h1>
          <p className="mt-1 text-muted-foreground">Chaque établissement possède ses propres utilisateurs et données.</p>
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
              <Button className="w-full" onClick={() => void createHospital()}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4">
        {hospitals.map((hospital) => (
          <Card key={hospital.id} className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{hospital.name}</h2>
                <p className="text-sm text-muted-foreground">{hospital.slug} · {hospital.email}</p>
                <p className="text-sm text-muted-foreground">{hospital.address}</p>
                <p className="mt-2 text-sm">
                  {hospital.status === "active" ? "Actif" : "Suspendu"} · Plan non configuré · {hospital.userCount ?? 0} utilisateurs
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAdminFor(hospital)}>Créer un administrateur</Button>
                <Button variant="outline" onClick={() => void toggleStatus(hospital)}>
                  {hospital.status === "active" ? "Suspendre" : "Réactiver"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
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
            <div className="space-y-2"><Label>Mot de passe temporaire</Label><Input type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} /></div>
            <Button className="w-full" onClick={() => void createAdmin()}>Créer le compte</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
