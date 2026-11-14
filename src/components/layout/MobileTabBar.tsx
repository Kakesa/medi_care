import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { allNavigation } from "./Sidebar";
import { useWorkBadges } from "@/contexts/WorkBadgeContext";
import { NavCount } from "./NavCount";

const shortLabels: Record<string, string> = {
  "/dashboard": "Accueil",
  "/dashboard/rendez-vous": "RDV",
  "/dashboard/examen": "Examen",
  "/dashboard/facture": "Facture",
  "/dashboard/laboratoire": "Labo",
  "/dashboard/supervision-lab": "Labo",
  "/dashboard/demandes-lab": "Labo",
  "/dashboard/ordonnances": "Ordo.",
  "/dashboard/pharmacie-ordonnances": "Ordo.",
  "/dashboard/hospitals": "Hôpitaux",
  "/dashboard/reception": "Récept.",
  "/dashboard/personnel": "Personnel",
  "/dashboard/patients": "Patient",
  "/dashboard/appointments": "RDV",
  "/dashboard/consultations": "Consult.",
  "/dashboard/examinations": "Examen",
  "/dashboard/surgery": "Chirurgie",
  "/dashboard/nursing": "Soins",
  "/dashboard/gardes": "Gardes",
  "/dashboard/billing": "Factures",
  "/dashboard/accounting": "Compta",
  "/dashboard/beds": "Lits",
  "/dashboard/pharmacy": "Pharmacie",
  "/dashboard/profile": "Profil",
};

const primaryOrder = [
  "/dashboard",
  "/dashboard/reception",
  "/dashboard/personnel",
  "/dashboard/consultations",
  "/dashboard/examinations",
  "/dashboard/examen",
  "/dashboard/surgery",
  "/dashboard/nursing",
  "/dashboard/gardes",
  "/dashboard/patients",
  "/dashboard/appointments",
  "/dashboard/rendez-vous",
  "/dashboard/facture",
  "/dashboard/billing",
  "/dashboard/accounting",
  "/dashboard/beds",
  "/dashboard/pharmacy",
  "/dashboard/laboratoire",
  "/dashboard/supervision-lab",
  "/dashboard/demandes-lab",
  "/dashboard/ordonnances",
  "/dashboard/pharmacie-ordonnances",
  "/dashboard/hospitals",
  "/dashboard/profile",
];

export function MobileTabBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const badges = useWorkBadges();

  const available = allNavigation.filter((item) => (user ? item.roles.includes(user.role) : false));
  const ordered = primaryOrder
    .map((href) => available.find((item) => item.href === href))
    .filter((item): item is (typeof available)[number] => Boolean(item));
  const tabs = ordered.slice(0, 4);
  const more = ordered.slice(4);
  const moreActive = more.some((item) => location.pathname === item.href);
  const moreCount = more.reduce((sum, item) => sum + (badges[item.href] || 0), 0);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate("/login");
  };

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navigation principale"
      >
        <div className="flex h-16 items-stretch">
          {tabs.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="absolute -right-2.5 -top-2">
                    <NavCount count={badges[item.href]} tone="alert" />
                  </span>
                </span>
                <span className="max-w-full truncate">{shortLabels[item.href] || item.name}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium",
              menuOpen || moreActive ? "text-primary" : "text-muted-foreground",
            )}
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <span className="relative">
              <LayoutGrid className="h-5 w-5 shrink-0" />
              <span className="absolute -right-2.5 -top-2">
                <NavCount count={moreCount} tone="alert" />
              </span>
            </span>
            <span>Menu</span>
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col rounded-t-2xl md:hidden">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          {more.length > 0 && (
            <div className="mt-4 grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-y-auto">
              {more.map((item) => {
                const active = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border border-border px-2 py-3 text-center text-xs font-medium",
                      active ? "border-primary bg-primary/10 text-primary" : "text-foreground",
                    )}
                  >
                    <span className="relative">
                      <item.icon className="h-5 w-5" />
                      <span className="absolute -right-3 -top-2">
                        <NavCount count={badges[item.href]} tone="solid" />
                      </span>
                    </span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
          <div className="mt-4 shrink-0 space-y-2 border-t border-border pt-4 pb-[env(safe-area-inset-bottom)]">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              {theme === "dark" ? "Mode clair" : "Mode sombre"}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 text-destructive" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
              Déconnexion
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
