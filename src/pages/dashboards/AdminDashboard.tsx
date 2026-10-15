import { useEffect, useState } from "react";
import { Users, UserCircle, Calendar, Activity, TrendingUp, Pill, FileText } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { appointmentService } from "@/services/appointmentService";
import { billingService } from "@/services/billingService";
import { consultationService } from "@/services/consultationService";
import { patientService } from "@/services/patientService";
import { personnelService } from "@/services/personnelService";
import { pharmacyService } from "@/services/pharmacyService";
import type { Appointment } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const weekDays = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function emptyWeek() {
  return ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((jour) => ({ jour, entrees: 0 }));
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const role = user?.role;
  const [stats, setStats] = useState<Array<{ title: string; value: number; change: string; changeType: "positive" | "negative" | "neutral"; icon: typeof Users; iconColor: string }>>([]);
  const [bars, setBars] = useState<Array<{ name: string; count: number }>>([]);
  const [pie, setPie] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [weekly, setWeekly] = useState(emptyWeek());

  useEffect(() => {
    const load = async () => {
      if (role === "PHARMACIST") {
        const products = await pharmacyService.getProducts({ limit: 100 });
        const rows = products.data;
        setStats([
          { title: "Produits", value: rows.length, change: "Références actives", changeType: "neutral", icon: Pill, iconColor: "bg-primary/10 text-primary" },
          { title: "En stock", value: rows.filter((item) => item.status === "in_stock").length, change: "Disponibles", changeType: "positive", icon: Activity, iconColor: "bg-success/10 text-success" },
          { title: "Stock faible", value: rows.filter((item) => item.status === "low_stock").length, change: "À réapprovisionner", changeType: "neutral", icon: TrendingUp, iconColor: "bg-warning/10 text-warning" },
          { title: "Ruptures", value: rows.filter((item) => item.status === "out_of_stock").length, change: "Indisponibles", changeType: "negative", icon: FileText, iconColor: "bg-destructive/10 text-destructive" },
        ]);
        const byCategory = new Map<string, number>();
        rows.forEach((item) => byCategory.set(item.category, (byCategory.get(item.category) || 0) + 1));
        setBars([...byCategory.entries()].map(([name, count]) => ({ name, count })));
        setPie([
          { name: "En stock", value: rows.filter((item) => item.status === "in_stock").length, color: "hsl(var(--success))" },
          { name: "Faible", value: rows.filter((item) => item.status === "low_stock").length, color: "hsl(var(--warning))" },
          { name: "Rupture", value: rows.filter((item) => item.status === "out_of_stock").length, color: "hsl(var(--destructive))" },
        ]);
        return;
      }

      if (role === "ACCOUNTANT") {
        const billing = await billingService.getStats();
        setStats([
          { title: "Encaissé", value: billing.totalRevenue, change: "Factures payées", changeType: "positive", icon: FileText, iconColor: "bg-success/10 text-success" },
          { title: "En attente", value: billing.pendingAmount, change: "À encaisser", changeType: "neutral", icon: Calendar, iconColor: "bg-warning/10 text-warning" },
          { title: "En retard", value: billing.overdueAmount, change: "Échéance dépassée", changeType: "negative", icon: TrendingUp, iconColor: "bg-destructive/10 text-destructive" },
          { title: "Factures", value: billing.invoiceCount, change: "Hors annulations", changeType: "neutral", icon: Users, iconColor: "bg-primary/10 text-primary" },
        ]);
        setPie([
          { name: "Payé", value: billing.totalRevenue, color: "hsl(var(--success))" },
          { name: "Attente", value: billing.pendingAmount, color: "hsl(var(--warning))" },
          { name: "Retard", value: billing.overdueAmount, color: "hsl(var(--destructive))" },
        ]);
        return;
      }

      const [personnel, patients, appointments, consultations] = await Promise.all([
        personnelService.getAll({ limit: 100 }),
        patientService.getAll({ limit: 100 }),
        appointmentService.getAll({ limit: 100 }),
        consultationService.getAll({ limit: 100 }),
      ]);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const todayAppointments = appointments.data.filter((item) => item.date === today && item.status !== "cancelled");
      setStats([
        { title: "Personnel actif", value: personnel.data.filter((item) => item.status === "active").length, change: "Fiches actives", changeType: "neutral", icon: Users, iconColor: "bg-primary/10 text-primary" },
        { title: "Patients", value: patients.total, change: "Dossiers ouverts", changeType: "neutral", icon: UserCircle, iconColor: "bg-info/10 text-info" },
        { title: "RDV aujourd'hui", value: todayAppointments.length, change: `${appointments.data.filter((item) => item.status === "pending").length} en attente`, changeType: "neutral", icon: Calendar, iconColor: "bg-warning/10 text-warning" },
        { title: "Consultations", value: consultations.total, change: "Dossiers cliniques", changeType: "neutral", icon: Activity, iconColor: "bg-success/10 text-success" },
      ]);
      const byDepartment = new Map<string, number>();
      personnel.data.forEach((item) => byDepartment.set(item.department, (byDepartment.get(item.department) || 0) + 1));
      setBars([...byDepartment.entries()].map(([name, count]) => ({ name, count })));
      setPie([
        { name: "En attente", value: appointments.data.filter((item) => item.status === "pending").length, color: "hsl(var(--warning))" },
        { name: "Confirmés", value: appointments.data.filter((item) => item.status === "confirmed").length, color: "hsl(var(--success))" },
        { name: "Terminés", value: appointments.data.filter((item) => item.status === "completed").length, color: "hsl(var(--primary))" },
        { name: "Annulés", value: appointments.data.filter((item) => item.status === "cancelled").length, color: "hsl(var(--destructive))" },
      ]);
      const week = emptyWeek();
      appointments.data.forEach((item: Appointment) => {
        const day = weekDays[new Date(`${item.date}T00:00:00`).getDay()];
        const row = week.find((entry) => entry.jour === day);
        if (row && item.status !== "cancelled") row.entrees += 1;
      });
      setWeekly(week);
    };
    if (role) void load().catch(() => undefined);
  }, [role]);

  return (
    <div className="space-y-8">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="mt-1 text-muted-foreground">Activité de votre établissement</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard key={stat.title} {...stat} delay={index * 50} />
        ))}
      </div>

      {role === "HOSPITAL_ADMIN" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Personnel par département
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={bars}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="Effectif" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Statut des rendez-vous
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                    {pie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {role === "HOSPITAL_ADMIN" && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Rendez-vous sur la période chargée
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="jour" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="entrees" stroke="hsl(var(--success))" strokeWidth={2} name="Rendez-vous" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {role === "HOSPITAL_ADMIN" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentActivity />
          <UpcomingAppointments />
        </div>
      )}
    </div>
  );
}
