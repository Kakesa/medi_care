import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "./dashboards/AdminDashboard";
import DoctorDashboard from "./dashboards/DoctorDashboard";
import PatientDashboard from "./dashboards/PatientDashboard";
import ReceptionDashboard from "./dashboards/ReceptionDashboard";

export default function Dashboard() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'doctor':
      return <DoctorDashboard />;
    case 'patient':
      return <PatientDashboard />;
    case 'receptionist':
      return <ReceptionDashboard />;
    default:
      return <PatientDashboard />;
  }
}