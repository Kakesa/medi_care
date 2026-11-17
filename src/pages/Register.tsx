import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Mail, Lock, Eye, EyeOff, ArrowRight, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-8 sm:items-center sm:p-6">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Activity className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">MediCare SIH</span>
          </Link>
          <h1 className="text-3xl font-bold">S'inscrire</h1>
          <p className="mt-2 text-muted-foreground">
            Patient ou centre hospitalier
          </p>
        </div>

        {/* Register form */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <HoneypotField />
            <div className="space-y-2">
              <Label htmlFor="accountType">Compte</Label>
              <select
                id="accountType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="patient"
                onChange={(event) => {
                  if (event.target.value === "centre") navigate("/inscription-centre");
                }}
              >
                <option value="patient">Patient</option>
                <option value="centre">Centre hospitalier</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Prénom
                </Label>
                <Input
                  id="firstName"
                  required
                  maxLength={80}
                  value={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  required
                  maxLength={80}
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  placeholder="Dupont"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                maxLength={160}
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="votre@email.fr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                Téléphone
              </Label>
              <Input
                id="phone"
                type="tel"
                maxLength={30}
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="06 XX XX XX XX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationSlug">Code de l'établissement</Label>
              <Input
                id="organizationSlug"
                required
                maxLength={80}
                value={formData.organizationSlug}
                onChange={(e) => handleChange("organizationSlug", e.target.value)}
                placeholder="clinique-nord"
              />
              <p className="text-xs text-muted-foreground">
                L'inscription publique crée un compte patient. Le personnel est créé par l'administrateur de l'établissement.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={128}
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                maxLength={128}
                value={formData.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
              {isLoading ? "Inscription..." : (
                <>
                  S'inscrire
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Déjà un compte ?</span>{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Se connecter
            </Link>
            <span className="mx-2 text-muted-foreground">·</span>
            <Link to="/confidentialite" className="text-muted-foreground hover:text-primary hover:underline">
              Confidentialité
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
