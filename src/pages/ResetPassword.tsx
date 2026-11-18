import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { AuthField, AuthScreen, AuthSubmit } from "@/components/auth/AuthScreen";
import { authService } from "@/services/authService";
import { apiMessage } from "@/lib/apiError";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { spamTrapFilled } from "@/lib/formChecks";

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
    if (spamTrapFilled(event.currentTarget)) return;
    if (token.trim().length < 20) {
      setError("Le lien de réinitialisation est incomplet. Redemandez un e-mail.");
      return;
    }
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
    <AuthScreen
      title="Nouveau mot de passe"
      backTo="/login"
      footer={<Link to="/confidentialite" className="text-xs hover:text-primary">Confidentialité</Link>}
    >
      {!token ? (
        <p className="text-sm">Ce lien est incomplet. Demandez un nouvel e-mail depuis la page mot de passe oublié.</p>
      ) : done ? (
        <p className="text-sm">{done}</p>
      ) : (
        <form onSubmit={submit}>
          <HoneypotField />
          <AuthField id="password" icon={Lock} label="Nouveau mot de passe" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nouveau mot de passe..." />
          <AuthField id="confirm" icon={Lock} label="Confirmer le mot de passe" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Confirmer le mot de passe..." />
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <AuthSubmit disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</AuthSubmit>
        </form>
      )}
    </AuthScreen>
  );
}
