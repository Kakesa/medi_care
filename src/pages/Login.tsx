import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { AuthField, AuthScreen, AuthSocial, AuthSubmit } from "@/components/auth/AuthScreen";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { isEmail, spamTrapFilled } from "@/lib/formChecks";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const submitLock = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (spamTrapFilled(e.currentTarget)) return;
    if (!isEmail(email)) {
      toast({ variant: "destructive", title: "Email invalide", description: "Indiquez une adresse e-mail complète." });
      return;
    }
    if (!password.trim()) {
      toast({ variant: "destructive", title: "Mot de passe requis", description: "Saisissez votre mot de passe." });
      return;
    }
    if (submitLock.current) return;
    submitLock.current = true;
    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        toast({
          title: "Connexion réussie",
          description: "Bienvenue sur MediCare SIH",
        });
        navigate("/dashboard");
      } else {
        toast({
          variant: "destructive",
          title: "Erreur de connexion",
          description: result.message,
        });
      }
    } finally {
      submitLock.current = false;
      setIsLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Connexion"
      center
      footer={
        <>
          <p>Pas encore de compte ? <Link to="/register" className="font-semibold text-primary">S'inscrire</Link></p>
          <Link to="/confidentialite" className="mt-3 inline-block text-xs hover:text-primary">Confidentialité</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <HoneypotField />
        <AuthField id="email" icon={Mail} label="Email" type="email" required maxLength={160} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email..." />
        <AuthField
          id="password"
          icon={Lock}
          label="Mot de passe"
          type={showPassword ? "text" : "password"}
          required
          maxLength={128}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe..."
          trailing={
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <div className="mt-3 text-right text-sm">
          <Link to="/forgot-password" className="text-primary">Mot de passe oublié ?</Link>
        </div>
        <AuthSubmit disabled={isLoading}>{isLoading ? "Connexion..." : "Se connecter"}</AuthSubmit>
        <AuthSocial />
      </form>
    </AuthScreen>
  );
}
