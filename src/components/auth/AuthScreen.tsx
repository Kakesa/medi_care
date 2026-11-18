import type { InputHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, type LucideIcon } from "lucide-react";

export function AuthScreen({
  title,
  backTo = "/",
  wide = false,
  children,
  footer,
}: {
  title: string;
  backTo?: string;
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-primary text-primary-foreground">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full border border-white/15" />
      <div className="pointer-events-none absolute -right-20 bottom-8 h-72 w-72 rounded-full border border-white/10" />
      <div className={`relative mx-auto flex min-h-screen w-full flex-col ${wide ? "max-w-xl" : "max-w-md"}`}>
        <header className="flex items-center px-2 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <Link to={backTo} aria-label="Retour" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="flex-1 pr-11 text-center text-lg font-semibold">{title}</h1>
        </header>
        <main className="relative z-10 -mt-8 flex flex-1 flex-col rounded-t-[2.25rem] bg-card px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-8 text-card-foreground shadow-[0_-18px_40px_rgba(0,0,0,0.12)]">
          {children}
          {footer ? <div className="mt-auto pt-8 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </main>
      </div>
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
    <label className="flex items-center gap-3 border-b border-border py-3.5">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
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
      className="mt-8 flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
    >
      {children}
    </button>
  );
}
