import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabels } from "@/lib/roles";
import { userAdminService, type AssignableRole } from "@/services/userAdminService";
import type { ApiError, User } from "@/types";

const roles: AssignableRole[] = [
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "RECEPTIONIST",
  "NURSE",
  "ACCOUNTANT",
  "PHARMACIST",
  "PATIENT",
];

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "DOCTOR" as AssignableRole,
};

export default function UsersAdmin() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await userAdminService.list();
      setUsers(response.data);
    } catch (reason) {
      setError((reason as ApiError).message || "Chargement impossible");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createUser = async () => {
    try {
      await userAdminService.create({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        role: form.role,
      });
      setIsOpen(false);
      setForm(emptyForm);
      toast({
        title: "Utilisateur créé",
        description: "Un mot de passe temporaire a été envoyé par e-mail. Il devra le changer à la première connexion.",
      });
      await load();
    } catch (reason) {
      toast({ variant: "destructive", title: "Création impossible", description: (reason as ApiError).message });
    }
  };

  const changeRole = async (account: User, role: AssignableRole) => {
    try {
      await userAdminService.updateRole(account.id, role);
      await load();
    } catch (reason) {
      toast({ variant: "destructive", title: "Modification refusée", description: (reason as ApiError).message });
    }
  };

  const toggleStatus = async (account: User) => {
    try {
      await userAdminService.updateStatus(account.id, account.isActive === false);
      await load();
    } catch (reason) {
      toast({ variant: "destructive", title: "Modification refusée", description: (reason as ApiError).message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Utilisateurs</h1>
          <p className="mt-1 text-muted-foreground">Comptes de {user?.organization?.name || "votre établissement"}.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="hero"><Plus className="mr-2 h-4 w-4" />Nouvel utilisateur</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un utilisateur</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Prénom</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                <div className="space-y-2"><Label>Nom</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <p className="text-sm text-muted-foreground">Un mot de passe temporaire sera envoyé à cet e-mail. La personne devra le changer à sa première connexion.</p>
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value as AssignableRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => void createUser()}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-3">
        {users.map((account) => (
          <Card key={account.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{account.firstName} {account.lastName}</p>
              <p className="text-sm text-muted-foreground">{account.email}</p>
              <p className="text-sm text-muted-foreground">{account.isActive === false ? "Désactivé" : "Actif"}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Select
                value={account.role}
                onValueChange={(value) => void changeRole(account, value as AssignableRole)}
                disabled={account.id === user?.id}
              >
                <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => void toggleStatus(account)} disabled={account.id === user?.id}>
                {account.isActive === false ? "Activer" : "Désactiver"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
