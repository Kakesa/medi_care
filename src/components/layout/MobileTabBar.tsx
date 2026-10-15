import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { allNavigation } from "./Sidebar";

const shortLabels: Record<string, string> = {
  "/dashboard": "Accueil",
  "/dashboard/hospitals": "Hôpitaux",
  "/dashboard/users": "Comptes",
  "/dashboard/reception": "Récept.",
  "/dashboard/personnel": "Équipe",
  "/dashboard/patients": "Patients",
  "/dashboard/appointments": "RDV",
  "/dashboard/consultations": "Consult.",
  "/dashboard/examinations": "Examens",
  "/dashboard/billing": "Factures",
  "/dashboard/accounting": "Compta",
  "/dashboard/beds": "Lits",
  "/dashboard/pharmacy": "Pharmacie",
  "/dashboard/profile": "Profil",
};

const primaryOrder = [
  "/dashboard",
  "/dashboard/patients",
  "/dashboard/appointments",
  "/dashboard/reception",
  "/dashboard/consultations",
  "/dashboard/examinations",
  "/dashboard/pharmacy",
  "/dashboard/billing",
  "/dashboard/beds",
  "/dashboard/hospitals",
  "/dashboard/users",
  "/dashboard/personnel",
  "/dashboard/accounting",
  "/dashboard/profile",
];

export function MobileTabBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const available = allNavigation.filter((item) => (user ? item.roles.includes(user.role) : false));
  const ordered = primaryOrder
    .map((href) => available.find((item) => item.href === href))
    .filter((item): item is (typeof available)[number] => Boolean(item));
  const tabs = ordered.slice(0, 4);
  const more = ordered.slice(4);
  const moreActive = more.some((item) => location.pathname === item.href);

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
                <item.icon className="h-5 w-5 shrink-0" />
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
            <LayoutGrid className="h-5 w-5 shrink-0" />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl md:hidden">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          {more.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
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
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
          <div className="mt-4 space-y-2 pb-[env(safe-area-inset-bottom)]">
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
