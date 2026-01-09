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

import { AppointmentRequestForm } from "@/components/forms/AppointmentRequestForm";

export default function Index() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border animate-slide-down">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow">
              <Activity className="h-6 w-6 text-primary-foreground transition-transform group-hover:rotate-12" />
            </div>
            <span className="text-xl font-bold">MediCare SIH</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" className="hover-scale">Tableau de bord</Button>
            </Link>
            <Link to="/login">
              <Button variant="hero" className="group">
                Connexion
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" />
          <div className="absolute top-60 -left-40 w-60 h-60 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="container mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-bounce-in">
            <Shield className="h-4 w-4" />
            Conforme RGPD & HL7
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 animate-slide-up opacity-0" style={{ animationDelay: '100ms' }}>
            Système d'Information
            <br />
            <span className="text-gradient">Hospitalier Moderne</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up opacity-0" style={{ animationDelay: "200ms" }}>
            Centralisez la gestion de votre établissement de santé : personnel, patients, 
            rendez-vous et consultations dans une interface unifiée.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up opacity-0" style={{ animationDelay: "300ms" }}>
            <a href="#rdv-form">
              <Button variant="hero" size="xl" className="group btn-glow">
                Demander un RDV
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
            <Link to="/login">
              <Button variant="outline" size="xl" className="hover-scale">
                Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Appointment Request Form Section */}
      <section id="rdv-form" className="py-20 px-6 bg-primary/5">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Demander un Rendez-vous</h2>
            <p className="text-muted-foreground text-lg">
              Remplissez le formulaire ci-dessous pour demander un rendez-vous
            </p>
          </div>
          <AppointmentRequestForm />
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-secondary/30 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-full h-full" 
            style={{ 
              backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.15) 1px, transparent 0)',
              backgroundSize: '40px 40px'
            }} 
          />
        </div>
        
        <div className="container mx-auto relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 animate-slide-up opacity-0">Fonctionnalités Complètes</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto animate-slide-up opacity-0" style={{ animationDelay: '100ms' }}>
              Une solution intégrée pour tous les besoins de votre établissement
            </p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-xl transition-all duration-500 animate-slide-up opacity-0 hover:-translate-y-2"
                style={{ animationDelay: `${200 + index * 100}ms` }}
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110 group-hover:rotate-3">
                  <feature.icon className="h-6 w-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="text-xl font-semibold mb-2 transition-colors group-hover:text-primary">{feature.title}</h3>
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
              <h2 className="text-3xl md:text-4xl font-bold mb-6 animate-slide-up opacity-0">
                Pourquoi choisir
                <br />
                <span className="text-gradient">MediCare SIH ?</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8 animate-slide-up opacity-0" style={{ animationDelay: '100ms' }}>
                Notre système a été conçu avec une approche méthodique Agile pour répondre 
                aux besoins spécifiques des établissements de santé modernes.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li 
                    key={benefit}
                    className="flex items-center gap-3 animate-slide-up opacity-0 group"
                    style={{ animationDelay: `${200 + index * 100}ms` }}
                  >
                    <div className="h-6 w-6 rounded-full bg-success/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-success/20">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <span className="text-foreground transition-colors group-hover:text-primary">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="relative animate-slide-up opacity-0" style={{ animationDelay: '300ms' }}>
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 animate-float">
                <div className="h-full w-full rounded-2xl bg-card border border-border shadow-xl flex items-center justify-center transition-all duration-500 hover:shadow-2xl hover:border-primary/30">
                  <div className="text-center p-8">
                    <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 transition-all duration-300 hover:scale-110 hover:bg-primary/20 animate-glow-pulse">
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
      <section className="py-20 px-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-primary/20 rounded-full blur-3xl animate-float" />
        </div>
        
        <div className="container mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 animate-slide-up opacity-0">
            Prêt à moderniser votre gestion hospitalière ?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10 animate-slide-up opacity-0" style={{ animationDelay: '100ms' }}>
            Découvrez comment MediCare SIH peut transformer la coordination 
            entre vos équipes administratives et médicales.
          </p>
          <Link to="/dashboard">
            <Button variant="hero" size="xl" className="group btn-glow animate-slide-up opacity-0" style={{ animationDelay: '200ms' }}>
              Commencer maintenant
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary transition-transform group-hover:scale-110">
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