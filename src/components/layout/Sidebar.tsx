import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  UserCircle, 
  Calendar, 
  Stethoscope, 
  FlaskConical, 
  FileText, 
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { name: "Personnel", href: "/dashboard/personnel", icon: Users },
  { name: "Patients", href: "/dashboard/patients", icon: UserCircle },
  { name: "Rendez-vous", href: "/dashboard/appointments", icon: Calendar },
  { name: "Consultations", href: "/dashboard/consultations", icon: Stethoscope },
  { name: "Examens", href: "/dashboard/exams", icon: FlaskConical },
  { name: "Rapports", href: "/dashboard/reports", icon: FileText },
  { name: "Paramètres", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <Activity className="h-6 w-6 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-lg font-bold text-sidebar-foreground">MediCare</h1>
            <p className="text-xs text-muted-foreground">SIH v1.0</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={cn(
                    "nav-link",
                    isActive && "nav-link-active"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && (
                    <span className="animate-fade-in">{item.name}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Déconnexion</span>}
        </Button>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground shadow-sm transition-colors hover:bg-secondary"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  );
}