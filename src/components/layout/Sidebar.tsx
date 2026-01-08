import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  UserCircle, 
  Calendar, 
  Stethoscope, 
  FlaskConical, 
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Activity,
  UserPlus,
  Pill,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const allNavigation = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard, roles: ['admin', 'doctor', 'patient', 'receptionist'] },
  { name: "Réception", href: "/dashboard/reception", icon: UserPlus, roles: ['admin', 'receptionist'] },
  { name: "Personnel", href: "/dashboard/personnel", icon: Users, roles: ['admin'] },
  { name: "Patients", href: "/dashboard/patients", icon: UserCircle, roles: ['admin', 'doctor', 'receptionist'] },
  { name: "Rendez-vous", href: "/dashboard/appointments", icon: Calendar, roles: ['admin', 'doctor', 'receptionist'] },
  { name: "Consultations", href: "/dashboard/consultations", icon: Stethoscope, roles: ['admin', 'doctor'] },
  { name: "Examens", href: "/dashboard/examinations", icon: FlaskConical, roles: ['admin', 'doctor'] },
  { name: "Facturation", href: "/dashboard/billing", icon: FileText, roles: ['admin'] },
  { name: "Pharmacie", href: "/dashboard/pharmacy", icon: Pill, roles: ['admin'] },
  { name: "Profil", href: "/dashboard/profile", icon: Settings, roles: ['admin', 'doctor', 'patient', 'receptionist'] },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navigation = allNavigation.filter(item => 
    item.roles.includes(user?.role || 'patient')
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
          onClick={handleLogout}
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