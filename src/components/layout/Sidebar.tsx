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
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border flex flex-col",
        "transition-all duration-300 ease-smooth",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary transition-transform duration-300 hover:scale-105 hover:shadow-glow">
          <Activity className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className={cn(
          "transition-all duration-300 overflow-hidden",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}>
          <h1 className="text-lg font-bold text-sidebar-foreground whitespace-nowrap">MediCare</h1>
          <p className="text-xs text-muted-foreground whitespace-nowrap">SIH v1.0</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <ul className="space-y-1">
          {navigation.map((item, index) => {
            const isActive = location.pathname === item.href;
            return (
              <li 
                key={item.name}
                className="animate-slide-up opacity-0"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Link
                  to={item.href}
                  className={cn(
                    "nav-link group",
                    isActive && "nav-link-active"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 shrink-0 transition-transform duration-200",
                    "group-hover:scale-110",
                    isActive && "text-primary"
                  )} />
                  <span className={cn(
                    "transition-all duration-300 whitespace-nowrap",
                    collapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
                  )}>
                    {item.name}
                  </span>
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
          className={cn(
            "w-full justify-start gap-3 text-muted-foreground",
            "transition-all duration-200 hover:text-destructive hover:bg-destructive/10",
            "group"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 transition-transform group-hover:scale-110 group-hover:-translate-x-0.5" />
          <span className={cn(
            "transition-all duration-300",
            collapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
          )}>
            Déconnexion
          </span>
        </Button>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full",
          "border border-sidebar-border bg-sidebar text-muted-foreground shadow-sm",
          "transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:border-primary",
          "hover:scale-110 active:scale-95"
        )}
      >
        <span className={cn(
          "transition-transform duration-300",
          collapsed ? "rotate-0" : "rotate-180"
        )}>
          <ChevronRight className="h-4 w-4" />
        </span>
      </button>
    </aside>
  );
}