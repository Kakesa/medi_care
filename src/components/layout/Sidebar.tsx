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
  FileText,
  Moon,
  Sun,
  Landmark,
  BedDouble,
  Building2,
  UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import type { UserRole } from "@/types";

const allNavigation: { name: string; href: string; icon: typeof LayoutDashboard; roles: UserRole[] }[] = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard, roles: ['SUPERADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'ACCOUNTANT', 'PHARMACIST', 'PATIENT'] },
  { name: "Hôpitaux", href: "/dashboard/hospitals", icon: Building2, roles: ['SUPERADMIN'] },
  { name: "Utilisateurs", href: "/dashboard/users", icon: UserCog, roles: ['HOSPITAL_ADMIN'] },
  { name: "Réception", href: "/dashboard/reception", icon: UserPlus, roles: ['HOSPITAL_ADMIN', 'RECEPTIONIST'] },
  { name: "Personnel", href: "/dashboard/personnel", icon: Users, roles: ['HOSPITAL_ADMIN'] },
  { name: "Patients", href: "/dashboard/patients", icon: UserCircle, roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'] },
  { name: "Rendez-vous", href: "/dashboard/appointments", icon: Calendar, roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST'] },
  { name: "Consultations", href: "/dashboard/consultations", icon: Stethoscope, roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'] },
  { name: "Examens", href: "/dashboard/examinations", icon: FlaskConical, roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'] },
  { name: "Facturation", href: "/dashboard/billing", icon: FileText, roles: ['HOSPITAL_ADMIN', 'ACCOUNTANT'] },
  { name: "Comptabilité", href: "/dashboard/accounting", icon: Landmark, roles: ['HOSPITAL_ADMIN', 'ACCOUNTANT'] },
  { name: "Gestion des lits", href: "/dashboard/beds", icon: BedDouble, roles: ['HOSPITAL_ADMIN', 'RECEPTIONIST'] },
  { name: "Pharmacie", href: "/dashboard/pharmacy", icon: Pill, roles: ['HOSPITAL_ADMIN', 'PHARMACIST'] },
  { name: "Profil", href: "/dashboard/profile", icon: Settings, roles: ['SUPERADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'ACCOUNTANT', 'PHARMACIST', 'PATIENT'] },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const navigation = allNavigation.filter(item =>
    user ? item.roles.includes(user.role) : false
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
      <div className="border-t border-sidebar-border p-3 space-y-1">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-muted-foreground",
            "transition-all duration-200 hover:text-foreground hover:bg-secondary",
            "group"
          )}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5 transition-transform group-hover:scale-110 group-hover:rotate-45" />
          ) : (
            <Moon className="h-5 w-5 transition-transform group-hover:scale-110 group-hover:-rotate-12" />
          )}
          <span className={cn(
            "transition-all duration-300",
            collapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
          )}>
            {theme === "dark" ? "Mode clair" : "Mode sombre"}
          </span>
        </Button>

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