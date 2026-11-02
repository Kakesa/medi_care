import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AppointmentRequestForm } from "@/components/forms/AppointmentRequestForm";
import {
  Activity,
  Users,
  UserCircle,
  Calendar,
  Stethoscope,
  FlaskConical,
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Users,
    title: "Gestion du Personnel",
    description: "Inscription, autorisation et planning du personnel médical",
    image: "/images/home/team.jpg",
  },
  {
    icon: UserCircle,
    title: "Dossiers Patients",
    description: "Dossiers médicaux complets avec historique et traçabilité",
    image: "/images/home/consult.jpg",
  },
  {
    icon: Calendar,
    title: "Rendez-vous",
    description: "Planification en ligne avec rappels automatiques",
    image: "/images/home/hero-2.jpg",
  },
  {
    icon: Stethoscope,
    title: "Consultations",
    description: "Suivi des consultations et diagnostics",
    image: "/images/home/care.jpg",
  },
  {
    icon: FlaskConical,
    title: "Examens & Labo",
    description: "Planification et résultats intégrés",
    image: "/images/home/lab.jpg",
  },
  {
    icon: Shield,
    title: "Sécurité RGPD",
    description: "Conformité aux normes de protection des données",
    image: "/images/home/ward.jpg",
  },
];

const benefits = [
  "Interface intuitive adaptée à chaque rôle",
  "Données médicales sécurisées et traçables",
  "Coordination optimisée entre services",
  "Rapports et statistiques en temps réel",
];

const slides = [
  {
    image: "/images/home/hero-1.jpg",
    kicker: "Conforme RGPD & HL7",
    title: "Système d'Information Hospitalier Moderne",
    text: "Centralisez la gestion de votre établissement de santé : personnel, patients, rendez-vous et consultations dans une interface unifiée.",
    action: "Demander un RDV",
    href: "#rdv-form",
  },
  {
    image: "/images/home/hero-2.jpg",
    kicker: "Établissement",
    title: "Une solution intégrée pour toutes vos équipes",
    text: "Une solution intégrée pour tous les besoins de votre établissement.",
    action: "Voir les fonctionnalités",
    href: "#services",
  },
  {
    image: "/images/home/hero-3.jpg",
    kicker: "Coordination",
    title: "Pourquoi choisir MediCare SIH ?",
    text: "Notre système a été conçu avec une approche méthodique Agile pour répondre aux besoins spécifiques des établissements de santé modernes.",
    action: "Se connecter",
    href: "/login",
  },
];

export default function Index() {
  const [active, setActive] = useState(0);
  const slide = slides[active];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, []);

  const go = (direction: number) => {
    setActive((current) => (current + direction + slides.length) % slides.length);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="bg-foreground text-background">
        <div className="container flex h-10 items-center justify-between gap-3 px-4 text-xs sm:text-sm">
          <span className="truncate">Système d'information hospitalier</span>
          <span className="hidden text-background/80 sm:inline">Conforme RGPD & HL7</span>
          <Link to="/login" className="shrink-0 font-medium hover:text-background">
            Espace professionnel
          </Link>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3 px-4 sm:h-20">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Activity className="h-5 w-5" />
            </span>
            <span className="truncate text-lg font-semibold tracking-tight sm:text-xl">MediCare</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground lg:flex">
            <a href="#services" className="transition-colors hover:text-primary">Fonctionnalités</a>
            <a href="#pourquoi" className="transition-colors hover:text-primary">Pourquoi MediCare</a>
            <a href="#galerie" className="transition-colors hover:text-primary">Établissement</a>
            <a href="#rdv-form" className="transition-colors hover:text-primary">Rendez-vous</a>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/dashboard" className="hidden sm:block">
              <Button variant="ghost">Tableau de bord</Button>
            </Link>
            <Link to="/login">
              <Button variant="hero" size="sm" className="sm:h-11 sm:px-5">Connexion</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative min-h-[78vh] overflow-hidden bg-foreground">
        {slides.map((item, index) => (
          <img
            key={item.image}
            src={item.image}
            alt={index === active ? item.title : ""}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              index === active ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/85 via-foreground/55 to-foreground/20" />
        <div className="relative flex min-h-[78vh] items-center px-4 py-16">
          <div className="container">
            <div className="max-w-2xl text-background">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-background/80">{slide.kicker}</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                {slide.title}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-background/85 sm:text-lg">{slide.text}</p>
              <div className="mt-8">
                {slide.href.startsWith("/") ? (
                  <Link to={slide.href}>
                    <Button variant="hero" size="lg">
                      {slide.action}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <a href={slide.href}>
                    <Button variant="hero" size="lg">
                      {slide.action}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-3">
          <button type="button" onClick={() => go(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm" aria-label="Visuel précédent">
            <ArrowLeft className="h-4 w-4" />
          </button>
          {slides.map((item, index) => (
            <button
              key={item.image}
              type="button"
              aria-label={`Visuel ${index + 1}`}
              onClick={() => setActive(index)}
              className={cn("h-2.5 rounded-full bg-background transition-all", index === active ? "w-8" : "w-2.5 bg-background/60")}
            />
          ))}
          <button type="button" onClick={() => go(1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm" aria-label="Visuel suivant">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section id="services" className="px-4 py-16 sm:py-24">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="section-kicker">Établissement</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Fonctionnalités Complètes</h2>
            <p className="mt-4 text-muted-foreground sm:text-lg">
              Une solution intégrée pour tous les besoins de votre établissement
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {features.slice(0, 3).map((feature) => (
              <article key={feature.title} className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
                <img src={feature.image} alt="" className="h-52 w-full object-cover" />
                <div className="p-6">
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pourquoi" className="bg-muted/70 px-4 py-16 sm:py-24">
        <div className="container grid items-center gap-12 lg:grid-cols-2">
          <div className="relative">
            <img
              src="/images/home/care.jpg"
              alt="Professionnel de santé en consultation"
              className="h-[460px] w-full rounded-[2rem] object-cover shadow-lg"
            />
            <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-background/95 p-4 shadow-md sm:right-auto sm:max-w-xs">
              <p className="text-sm text-primary">Tableau de bord</p>
              <p className="font-semibold">Vue d'ensemble de l'activité hospitalière</p>
            </div>
          </div>
          <div>
            <p className="section-kicker">Coordination</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pourquoi choisir MediCare SIH ?</h2>
            <p className="mt-5 text-muted-foreground sm:text-lg">
              Notre système a été conçu avec une approche méthodique Agile pour répondre
              aux besoins spécifiques des établissements de santé modernes.
            </p>
            <ul className="mt-8 space-y-4">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <CheckCircle className="h-4 w-4" />
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {features.slice(3, 5).map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-border/70 bg-card p-4">
                  <feature.icon className="mb-3 h-5 w-5 text-primary" />
                  <p className="font-semibold">{feature.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="galerie" className="px-4 py-16 sm:py-24">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="section-kicker">Services</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Le parcours de votre établissement</h2>
            <p className="mt-4 text-muted-foreground sm:text-lg">
              Personnel, patients, rendez-vous, consultations, examens et sécurité des données.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="group relative h-72 overflow-hidden rounded-[1.75rem]">
                <img src={feature.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-background">
                  <feature.icon className="mb-2 h-5 w-5" />
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm text-background/80">{feature.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-20">
        <img src="/images/home/hero-1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-primary/85" />
        <div className="relative container flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl text-primary-foreground">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Prêt à moderniser votre gestion hospitalière ?
            </h2>
            <p className="mt-4 text-primary-foreground/90 sm:text-lg">
              Découvrez comment MediCare SIH peut transformer la coordination
              entre vos équipes administratives et médicales.
            </p>
          </div>
          <Link to="/dashboard">
            <Button size="lg" className="rounded-full bg-background text-primary hover:bg-background/90">
              Commencer maintenant
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section id="rdv-form" className="px-4 py-16 sm:py-24">
        <div className="container grid items-start gap-10 lg:grid-cols-2">
          <div>
            <img
              src="/images/home/consult.jpg"
              alt="Accueil d'un patient"
              className="mb-8 h-72 w-full rounded-[2rem] object-cover shadow-md"
            />
            <p className="section-kicker">Prise en charge</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Demander un Rendez-vous</h2>
            <p className="mt-4 text-muted-foreground sm:text-lg">
              Remplissez le formulaire ci-dessous pour demander un rendez-vous
            </p>
            <ul className="mt-6 space-y-3">
              {benefits.slice(0, 3).map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <AppointmentRequestForm />
        </div>
      </section>

      <footer className="border-t border-border bg-foreground px-4 py-12 text-background">
        <div className="container grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Activity className="h-5 w-5" />
              </span>
              <p className="text-lg font-semibold">MediCare SIH</p>
            </div>
            <p className="mt-4 max-w-xs text-sm text-background/75">
              Centralisez la gestion de votre établissement de santé dans une interface unifiée.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-background/80">
            <p className="mb-1 font-semibold text-background">Navigation</p>
            <a href="#services" className="hover:text-background">Fonctionnalités</a>
            <a href="#galerie" className="hover:text-background">Établissement</a>
            <a href="#rdv-form" className="hover:text-background">Demander un rendez-vous</a>
            <Link to="/login" className="hover:text-background">Connexion</Link>
          </div>
          <p className="text-sm text-background/75">
            © 2024 MediCare SIH. Système conforme RGPD et normes HL7.
          </p>
        </div>
      </footer>
    </div>
  );
}
