import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Menu, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { roleLabels } from "@/lib/roles";

export function DashboardLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center px-6 text-center">Chargement...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex !w-[min(100vw,18rem)] !max-w-none flex-col p-0 md:hidden">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Sidebar variant="drawer" onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:gap-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="relative hidden min-w-0 flex-1 sm:block sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher patients, personnel, RDV..."
              className="border-transparent bg-secondary/50 pl-10 focus:border-input focus:bg-background"
            />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <NotificationDropdown />

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground">
                  {roleLabels[user?.role || "PATIENT"]}
                  {user?.organization?.name ? ` · ${user.organization.name}` : ""}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
