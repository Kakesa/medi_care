import { Outlet, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";

const roleLabels: Record<string, string> = {
  admin: "Administrateur",
  doctor: "Médecin",
  patient: "Patient",
  receptionist: "Réceptionniste"
};

export function DashboardLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Chargement...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main content */}
      <div className="pl-64 transition-all duration-300">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Rechercher patients, personnel, RDV..."
                className="pl-10 bg-secondary/50 border-transparent focus:bg-background focus:border-input"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationDropdown />
            
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground">{roleLabels[user?.role || ''] || user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}