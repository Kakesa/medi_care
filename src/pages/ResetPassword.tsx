import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { authService } from "@/services/authService";
import { apiMessage } from "@/lib/apiError";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await authService.confirmPasswordReset(token, password);
      setDone(result.message || "Mot de passe modifié. Vous pouvez vous connecter.");
    } catch (caught) {
      setError(apiMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-8 sm:items-center sm:p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="mb-8 inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Activity className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">MediCare SIH</span>
          </Link>
          <h1 className="text-3xl font-bold">Nouveau mot de passe</h1>
        </div>
        <Card className="p-6">
          {!token ? (
            <p className="text-sm">Ce lien est incomplet. Demandez un nouvel e-mail depuis la page mot de passe oublié.</p>
          ) : done ? (
            <p className="text-sm">{done}</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Nouveau mot de passe
                </Label>
                <Input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <Input id="confirm" type="password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="hero" className="w-full" disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </form>
          )}
          <div className="mt-6 text-center text-sm">
            <Link to="/login" className="font-medium text-primary hover:underline">Retour à la connexion</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
