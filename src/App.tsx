import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import Personnel from "./pages/Personnel";
import Patients from "./pages/Patients";
import Appointments from "./pages/Appointments";
import Consultations from "./pages/Consultations";
import Reception from "./pages/Reception";
import Examinations from "./pages/Examinations";
import Pharmacy from "./pages/Pharmacy";
import Billing from "./pages/Billing";
import Accounting from "./pages/Accounting";
import BedManagement from "./pages/BedManagement";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Hospitals from "./pages/Hospitals";
import UsersAdmin from "./pages/UsersAdmin";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { RequireRole } from "./components/auth/RequireRole";

const queryClient = new QueryClient();

function SessionGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    const onExpired = () => navigate("/login", { replace: true });
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [navigate]);

  return null;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SessionGuard />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="hospitals" element={<RequireRole roles={["SUPERADMIN"]}><Hospitals /></RequireRole>} />
                <Route path="users" element={<RequireRole roles={["HOSPITAL_ADMIN"]}><UsersAdmin /></RequireRole>} />
                <Route path="personnel" element={<RequireRole roles={["HOSPITAL_ADMIN"]}><Personnel /></RequireRole>} />
                <Route path="patients" element={<RequireRole roles={["HOSPITAL_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"]}><Patients /></RequireRole>} />
                <Route path="appointments" element={<RequireRole roles={["HOSPITAL_ADMIN", "DOCTOR", "RECEPTIONIST"]}><Appointments /></RequireRole>} />
                <Route path="consultations" element={<RequireRole roles={["HOSPITAL_ADMIN", "DOCTOR", "NURSE"]}><Consultations /></RequireRole>} />
                <Route path="reception" element={<RequireRole roles={["HOSPITAL_ADMIN", "RECEPTIONIST"]}><Reception /></RequireRole>} />
                <Route path="examinations" element={<RequireRole roles={["HOSPITAL_ADMIN", "DOCTOR", "NURSE"]}><Examinations /></RequireRole>} />
                <Route path="pharmacy" element={<RequireRole roles={["HOSPITAL_ADMIN", "PHARMACIST"]}><Pharmacy /></RequireRole>} />
                <Route path="billing" element={<RequireRole roles={["HOSPITAL_ADMIN", "ACCOUNTANT"]}><Billing /></RequireRole>} />
                <Route path="accounting" element={<RequireRole roles={["HOSPITAL_ADMIN", "ACCOUNTANT"]}><Accounting /></RequireRole>} />
                <Route path="beds" element={<RequireRole roles={["HOSPITAL_ADMIN", "RECEPTIONIST"]}><BedManagement /></RequireRole>} />
                <Route path="profile" element={<Profile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </TooltipProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
