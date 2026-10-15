import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function ForcePasswordChange() {
  const { changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    setIsSaving(true);
    setError("");
    const result = await changePassword(currentPassword, newPassword);
    setIsSaving(false);
    if (!result.success) setError(result.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">Choisissez votre mot de passe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          C'est votre première connexion. Le mot de passe reçu par e-mail doit être remplacé avant d'accéder à MediCare.
        </p>
        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Mot de passe reçu par e-mail</Label>
            <Input id="currentPassword" type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nouveau mot de passe</Label>
            <Input id="newPassword" type="password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
            <Input id="confirmPassword" type="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? "Enregistrement..." : "Enregistrer et continuer"}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={logout}>
            Se déconnecter
          </Button>
        </form>
      </Card>
    </div>
  );
}
