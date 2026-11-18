import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Activity className="h-6 w-6" />
          </span>
          <span className="text-xl font-semibold">HopeCare</span>
        </Link>
        <p className="mt-8 text-sm font-medium uppercase tracking-wide text-primary">Erreur 404</p>
        <h1 className="mt-2 text-3xl font-bold">Page introuvable</h1>
        <p className="mt-3 text-muted-foreground">
          Cette adresse n’existe pas ou a été déplacée. Vérifiez le lien, ou revenez à l’accueil.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="hero" asChild>
            <Link to="/">Accueil</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/login">Connexion</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
