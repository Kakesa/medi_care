import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { authService } from "@/services/authService";
import { apiMessage } from "@/lib/apiError";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const result = await authService.requestPasswordReset(email);
      setSent(result.message || "Si un compte existe pour cette adresse, un e-mail de réinitialisation a été envoyé.");
    } catch (caught) {
      setError(apiMessage(caught));
    } finally {
      setSending(false);
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
          <h1 className="text-3xl font-bold">Mot de passe oublié</h1>
          <p className="mt-2 text-muted-foreground">Indiquez votre e-mail. Nous vous enverrons un lien pour en choisir un nouveau.</p>
        </div>
        <Card className="p-6">
          {sent ? (
            <p className="text-sm">{sent}</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Email
                </Label>
                <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="votre@email.fr" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="hero" className="w-full" disabled={sending}>
                {sending ? "Envoi..." : "Envoyer le lien"}
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
