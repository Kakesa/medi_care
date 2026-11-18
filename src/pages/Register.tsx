import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, User, Phone, Building2 } from "lucide-react";
import { AuthField, AuthScreen, AuthSocial, AuthSubmit } from "@/components/auth/AuthScreen";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { isEmail, isSlug, spamTrapFilled } from "@/lib/formChecks";

export default function Register() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    organizationSlug: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const submitLock = useRef(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (spamTrapFilled(e.currentTarget)) return;

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast({ variant: "destructive", title: "Identité requise", description: "Indiquez votre prénom et votre nom." });
      return;
    }
    if (!isEmail(formData.email)) {
      toast({ variant: "destructive", title: "Email invalide", description: "Indiquez une adresse e-mail complète." });
      return;
    }
    if (formData.phone.trim() && formData.phone.trim().length < 6) {
      toast({ variant: "destructive", title: "Téléphone invalide", description: "Le numéro doit contenir au moins 6 caractères." });
      return;
    }
    if (!isSlug(formData.organizationSlug) || formData.organizationSlug.trim().length < 3) {
      toast({ variant: "destructive", title: "Établissement invalide", description: "Le code utilise des minuscules, des chiffres et des tirets. Exemple : clinique-nord." });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 8 caractères",
      });
      return;
    }

    if (submitLock.current) return;
    submitLock.current = true;
    setIsLoading(true);

    try {
      const result = await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        organizationSlug: formData.organizationSlug.trim().toLowerCase()
      });

      if (result.success) {
        toast({
          title: "Inscription réussie",
          description: "Bienvenue sur MediCare SIH",
        });
        navigate("/dashboard");
      } else {
        toast({
          variant: "destructive",
          title: "Erreur d'inscription",
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
      title="Inscription"
      backTo="/login"
      footer={
        <>
          <p>Déjà un compte ? <Link to="/login" className="font-semibold text-primary">Se connecter</Link></p>
          <Link to="/confidentialite" className="mt-3 inline-block text-xs hover:text-primary">Confidentialité</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <HoneypotField />
        <div className="mb-4 grid grid-cols-2 gap-2">
          <span className="rounded-full bg-primary py-2 text-center text-sm font-semibold text-primary-foreground">Patient</span>
          <button type="button" onClick={() => navigate("/inscription-centre")} className="rounded-full border border-border py-2 text-sm text-muted-foreground">
            Centre
          </button>
        </div>
        <AuthField id="firstName" icon={User} label="Prénom" required maxLength={80} autoComplete="given-name" value={formData.firstName} onChange={(e) => handleChange("firstName", e.target.value)} placeholder="Prénom..." />
        <AuthField id="lastName" icon={User} label="Nom" required maxLength={80} autoComplete="family-name" value={formData.lastName} onChange={(e) => handleChange("lastName", e.target.value)} placeholder="Nom..." />
        <AuthField id="email" icon={Mail} label="Email" type="email" required maxLength={160} autoComplete="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="Email..." />
        <AuthField id="phone" icon={Phone} label="Téléphone" type="tel" maxLength={30} autoComplete="tel" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="Téléphone..." />
        <AuthField id="organizationSlug" icon={Building2} label="Code de l'établissement" required maxLength={80} value={formData.organizationSlug} onChange={(e) => handleChange("organizationSlug", e.target.value)} placeholder="Code de l'établissement..." />
        <p className="mt-2 text-xs text-muted-foreground">L'inscription publique crée un compte patient. Le personnel est créé par l'administrateur.</p>
        <AuthField
          id="password"
          icon={Lock}
          label="Mot de passe"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={formData.password}
          onChange={(e) => handleChange("password", e.target.value)}
          placeholder="Mot de passe..."
          trailing={
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <AuthField id="confirmPassword" icon={Lock} label="Confirmer le mot de passe" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={formData.confirmPassword} onChange={(e) => handleChange("confirmPassword", e.target.value)} placeholder="Confirmer le mot de passe..." />
        <AuthSubmit disabled={isLoading}>{isLoading ? "Inscription..." : "S'inscrire"}</AuthSubmit>
        <AuthSocial />
      </form>
    </AuthScreen>
  );
}
