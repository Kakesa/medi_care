import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type AuthSlide = { src: string; role: string; title: string; text: string; focus?: string };

export const authSlides: AuthSlide[] = [
  {
    src: "/auth/reception.jpeg",
    role: "Réception",
    title: "L’accueil du patient, dès l’arrivée.",
    text: "La réception enregistre le passage, pose le rendez-vous et oriente vers la consultation ou le laboratoire.",
    focus: "object-[18%_center]",
  },
  {
    src: "/auth/infirmiere.jpeg",
    role: "Infirmier",
    title: "Les soins du service, au chevet du patient.",
    text: "La feuille de traitement, les administrations du jour et les gardes restent visibles pour toute l’équipe infirmière.",
    focus: "object-[30%_center]",
  },
  {
    src: "/auth/pharmacie.jpg",
    role: "Pharmacie",
    title: "L’ordonnance passe du médecin au comptoir.",
    text: "Le pharmacien prépare la délivrance, suit le stock et retrouve le journal des ventes de son officine.",
  },
  {
    src: "/auth/docteur.jpg",
    role: "Médecin",
    title: "La consultation et le dossier, au même endroit.",
    text: "Le médecin reprend l’historique, rédige la conclusion et prépare l’ordonnance sans quitter la fiche du patient.",
  },
];

function LoginShowcase({ slides }: { slides: AuthSlide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 7000);
    return () => window.clearInterval(timer);
  }, [slides.length, index]);

  return (
    <aside className="relative hidden overflow-hidden md:block md:h-dvh">
      {slides.map((item, itemIndex) => (
        <img
          key={item.src}
          src={item.src}
          alt=""
          className={`auth-slide-photo absolute inset-0 h-full w-full object-cover ${item.focus ?? "object-center"} ${itemIndex === index ? "scale-100 opacity-100" : "scale-105 opacity-0"}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
        <Link to="/" className="text-2xl font-semibold">HopeCare</Link>
        <div className="max-w-md">
          <div className="relative min-h-[15.5rem]">
            {slides.map((item, itemIndex) => (
              <div
                key={item.role}
                className={`auth-slide-copy absolute inset-x-0 bottom-0 ${itemIndex === index ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
              >
                <p className="text-sm font-medium uppercase tracking-[0.14em] text-white/80">{item.role}</p>
                <h2 className="mt-2 text-3xl font-semibold leading-tight">{item.title}</h2>
                <p className="mt-3 text-base leading-relaxed text-white/90">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            {slides.map((item, itemIndex) => (
              <button
                key={item.role}
                type="button"
                aria-label={item.role}
                onClick={() => setIndex(itemIndex)}
                className={`h-2 rounded-full transition-all duration-500 ${itemIndex === index ? "w-8 bg-white" : "w-2 bg-white/50"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AuthScreen({
  title,
  backTo = "/",
  wide = false,
  center = false,
  slides,
  children,
  footer,
}: {
  title: string;
  backTo?: string;
  wide?: boolean;
  center?: boolean;
  slides?: AuthSlide[];
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-primary md:grid md:h-dvh md:grid-cols-2 md:overflow-hidden">
      {slides ? <LoginShowcase slides={slides} /> : null}
      {!slides && <aside className="relative hidden overflow-hidden text-primary-foreground md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:justify-between md:px-14 md:py-12">
        <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute -right-10 bottom-10 h-72 w-72 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute right-16 top-24 h-40 w-40 rounded-full border border-white/10" />
        <Link to="/" className="relative z-10 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary">
            <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden><path d="M14 6h4v6h6v4h-6v6h-4v-6H8v-4h6z" fill="currentColor" /></svg>
          </span>
          <span className="text-xl font-semibold">HopeCare</span>
        </Link>
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-semibold leading-tight">Votre espace hospitalier, dans une seule application.</h2>
          <p className="mt-4 text-base text-primary-foreground/80">Patients, rendez-vous, soins, laboratoire et pharmacie.</p>
        </div>
        <p className="relative z-10 text-sm text-primary-foreground/70">HopeCare</p>
      </aside>}

      <section className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-primary md:bg-card">
        <header className="flex shrink-0 items-center px-1 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))] text-primary-foreground md:hidden">
          <Link to={backTo} aria-label="Retour" className="flex h-11 w-11 items-center justify-center">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <p className="flex-1 pr-11 text-center text-base font-semibold">{title}</p>
        </header>
        <div className="relative z-10 -mt-8 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[2.4rem] bg-card px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 text-card-foreground shadow-[0_-12px_30px_rgba(0,0,0,0.08)] md:mt-0 md:rounded-none md:px-16 md:py-10 md:shadow-none">
          <div className={`mx-auto w-full ${center ? "my-auto" : ""} ${wide ? "max-w-2xl" : "max-w-[26rem]"}`}>
            <h1 className="mb-8 hidden text-3xl font-semibold md:block">{title}</h1>
            {children}
            {footer ? <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function AuthField({
  icon: Icon,
  label,
  trailing,
  ...input
}: {
  icon: LucideIcon;
  label: string;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-3 border-b border-border py-4">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        {...input}
      />
      {trailing}
    </label>
  );
}

export function AuthSubmit({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-8 flex h-[52px] w-full items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function BrandButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-12 items-center justify-center rounded-full bg-muted">
      {children}
    </button>
  );
}

export function AuthSocial() {
  const { toast } = useToast();
  const soon = (name: string) => {
    toast({ title: name, description: "Utilisez l’e-mail et le mot de passe de votre compte HopeCare." });
  };

  return (
    <div className="mt-7">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        Ou continuer avec
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <BrandButton label="Google" onClick={() => soon("Google")}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#EA4335" d="M12 11v2.8h4.6c-.2 1.2-1.4 3.5-4.6 3.5A5.3 5.3 0 1 1 12 6.7c1.5 0 2.5.6 3.1 1.2l2.1-2A8.5 8.5 0 1 0 12 20.5c4.9 0 8.1-3.4 8.1-8.3 0-.6 0-1-.1-1.4H12z" /></svg>
        </BrandButton>
        <BrandButton label="Facebook" onClick={() => soon("Facebook")}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#1877F2" d="M14.5 21v-7h2.4l.4-2.8h-2.8V9.4c0-.8.2-1.4 1.4-1.4H17.4V5.5c-.2 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2.2H9.2V14h2.6v7h2.7z" /></svg>
        </BrandButton>
        <BrandButton label="Apple" onClick={() => soon("Apple")}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="currentColor" d="M16.4 12.6c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.3-.1-2.6.8-3.3.8s-1.7-.8-2.9-.7c-1.5.1-2.8.9-3.6 2.2-1.5 2.7-.4 6.6 1.1 8.8.7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7s1.7.7 2.9.7 1.9-1.1 2.6-2.1c.8-1.2 1.1-2.3 1.2-2.4-.1 0-2.2-.8-2.2-3.8zM14.7 6.8c.6-.7 1-1.7.9-2.8-1 .1-2.1.6-2.8 1.4-.6.7-1.1 1.7-.9 2.7 1 .1 2.1-.5 2.8-1.3z" /></svg>
        </BrandButton>
      </div>
    </div>
  );
}
