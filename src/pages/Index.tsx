import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Users, 
  UserCircle, 
  Calendar, 
  Stethoscope, 
  FlaskConical,
  Shield,
  ArrowRight,
  CheckCircle
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Gestion du Personnel",
    description: "Inscription, autorisation et planning du personnel médical"
  },
  {
    icon: UserCircle,
    title: "Dossiers Patients",
    description: "Dossiers médicaux complets avec historique et traçabilité"
  },
  {
    icon: Calendar,
    title: "Rendez-vous",
    description: "Planification en ligne avec rappels automatiques"
  },
  {
    icon: Stethoscope,
    title: "Consultations",
    description: "Suivi des consultations et diagnostics"
  },
  {
    icon: FlaskConical,
    title: "Examens & Labo",
    description: "Planification et résultats intégrés"
  },
  {
    icon: Shield,
    title: "Sécurité RGPD",
    description: "Conformité aux normes de protection des données"
  }
];

const benefits = [
  "Interface intuitive adaptée à chaque rôle",
  "Données médicales sécurisées et traçables",
  "Coordination optimisée entre services",
  "Rapports et statistiques en temps réel"
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">MediCare SIH</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost">Tableau de bord</Button>
            </Link>
            <Button variant="hero">
              Connexion
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
            <Shield className="h-4 w-4" />
            Conforme RGPD & HL7
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 animate-slide-up">
            Système d'Information
            <br />
            <span className="text-primary">Hospitalier Moderne</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: "100ms" }}>
            Centralisez la gestion de votre établissement de santé : personnel, patients, 
            rendez-vous et consultations dans une interface unifiée.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: "200ms" }}>
            <Link to="/dashboard">
              <Button variant="hero" size="xl">
                Accéder au tableau de bord
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="xl">
              En savoir plus
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Fonctionnalités Complètes</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Une solution intégrée pour tous les besoins de votre établissement
            </p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Pourquoi choisir
                <br />
                <span className="text-primary">MediCare SIH ?</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Notre système a été conçu avec une approche méthodique Agile pour répondre 
                aux besoins spécifiques des établissements de santé modernes.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li 
                    key={benefit}
                    className="flex items-center gap-3 animate-slide-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="h-6 w-6 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <span className="text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8">
                <div className="h-full w-full rounded-2xl bg-card border border-border shadow-xl flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                      <Activity className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Tableau de bord</h3>
                    <p className="text-muted-foreground">
                      Vue d'ensemble complète de votre activité hospitalière
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Prêt à moderniser votre gestion hospitalière ?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
            Découvrez comment MediCare SIH peut transformer la coordination 
            entre vos équipes administratives et médicales.
          </p>
          <Link to="/dashboard">
            <Button variant="hero" size="xl">
              Commencer maintenant
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">MediCare SIH</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 MediCare SIH. Système conforme RGPD et normes HL7.
          </p>
        </div>
      </footer>
    </div>
  );
}