import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "./dashboards/AdminDashboard";
import DoctorDashboard from "./dashboards/DoctorDashboard";
import PatientDashboard from "./dashboards/PatientDashboard";
import ReceptionDashboard from "./dashboards/ReceptionDashboard";
import LaborantinWorkspace from "./laboratory/LaborantinWorkspace";
import SuperAdminDashboard from "./dashboards/SuperAdminDashboard";

export default function Dashboard() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'SUPERADMIN':
      return <SuperAdminDashboard />;
    case 'HOSPITAL_ADMIN':
      return <AdminDashboard />;
    case 'DOCTOR':
    case 'NURSE':
      return <DoctorDashboard />;
    case 'PATIENT':
      return <PatientDashboard />;
    case 'RECEPTIONIST':
      return <ReceptionDashboard />;
    case 'LABORANTIN':
      return <LaborantinWorkspace />;
    case 'ACCOUNTANT':
      return <AdminDashboard />;
    case 'PHARMACIST':
      return <AdminDashboard />;
    default:
      return <PatientDashboard />;
  }
}