import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

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
    
    setIsLoading(false);
  };

  // Demo accounts
  const demoAccounts = [
    { role: "Admin", email: "admin@medicare.fr", password: "admin123" },
    { role: "Médecin", email: "dr.bernard@medicare.fr", password: "doctor123" },
    { role: "Patient", email: "patient@email.fr", password: "patient123" },
    { role: "Réception", email: "reception@medicare.fr", password: "reception123" },
  ];

  const fillDemo = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Activity className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">MediCare SIH</span>
          </Link>
          <h1 className="text-3xl font-bold">Connexion</h1>
          <p className="mt-2 text-muted-foreground">
            Accédez à votre espace personnel
          </p>
        </div>

        {/* Login form */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.fr"
              />
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-input" />
                <span className="text-muted-foreground">Se souvenir de moi</span>
              </label>
              <Link to="/forgot-password" className="text-primary hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
              {isLoading ? "Connexion..." : (
                <>
                  Se connecter
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Pas encore de compte ?</span>{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">
              S'inscrire
            </Link>
          </div>
        </Card>

        {/* Demo accounts */}
        <Card className="p-4 bg-secondary/50">
          <p className="text-sm font-medium mb-3 text-center">Comptes de démo</p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                onClick={() => fillDemo(account.email, account.password)}
                className="text-xs px-3 py-2 rounded-lg bg-background hover:bg-primary/10 border border-border transition-colors text-left"
              >
                <span className="font-medium text-foreground">{account.role}</span>
                <br />
                <span className="text-muted-foreground truncate block">{account.email}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
