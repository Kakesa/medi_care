import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { AuthField, AuthScreen, AuthSubmit } from "@/components/auth/AuthScreen";
import { authService } from "@/services/authService";
import { apiMessage } from "@/lib/apiError";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { isEmail, spamTrapFilled } from "@/lib/formChecks";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (spamTrapFilled(event.currentTarget)) return;
    if (!isEmail(email)) {
      setError("Indiquez une adresse e-mail complète.");
      return;
    }
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
    <AuthScreen
      title="Mot de passe oublié"
      backTo="/login"
      footer={<Link to="/confidentialite" className="text-xs hover:text-primary">Confidentialité</Link>}
    >
      <p className="mb-4 text-sm text-muted-foreground">Indiquez votre e-mail. Un lien permettra d’en choisir un nouveau.</p>
      {sent ? (
        <p className="text-sm">{sent}</p>
      ) : (
        <form onSubmit={submit}>
          <HoneypotField />
          <AuthField id="email" icon={Mail} label="Email" type="email" required maxLength={160} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email..." />
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <AuthSubmit disabled={sending}>{sending ? "Envoi..." : "Envoyer le lien"}</AuthSubmit>
        </form>
      )}
    </AuthScreen>
  );
}
