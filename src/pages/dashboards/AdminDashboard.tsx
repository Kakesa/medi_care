import { Users, UserCircle, Calendar, Activity, TrendingUp, Bed, Pill, FileText } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockPersonnel, mockPatients, mockAppointments, mockConsultations, mockPharmacyProducts } from "@/data/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

const stats = [
  {
    title: "Personnel actif",
    value: mockPersonnel.filter(p => p.status === 'active').length,
    change: "+12% ce mois",
    changeType: "positive" as const,
    icon: Users,
    iconColor: "bg-primary/10 text-primary"
  },
  {
    title: "Patients enregistrés",
    value: mockPatients.length,
    change: "+8% ce mois",
    changeType: "positive" as const,
    icon: UserCircle,
    iconColor: "bg-info/10 text-info"
  },
  {
    title: "RDV aujourd'hui",
    value: mockAppointments.filter(a => a.status !== 'cancelled').length,
    change: `${mockAppointments.filter(a => a.status === 'pending').length} en attente`,
    changeType: "neutral" as const,
    icon: Calendar,
    iconColor: "bg-warning/10 text-warning"
  },
  {
    title: "Consultations",
    value: mockConsultations.length,
    change: "+24% cette semaine",
    changeType: "positive" as const,
    icon: Activity,
    iconColor: "bg-success/10 text-success"
  },
  {
    title: "Produits en stock",
    value: mockPharmacyProducts.filter(p => p.status === 'in_stock').length,
    change: `${mockPharmacyProducts.filter(p => p.status === 'low_stock').length} stock faible`,
    changeType: mockPharmacyProducts.some(p => p.status === 'out_of_stock') ? "negative" as const : "neutral" as const,
    icon: Pill,
    iconColor: "bg-accent/10 text-accent"
  },
  {
    title: "Lits disponibles",
    value: 23,
    change: "sur 180",
    changeType: "neutral" as const,
    icon: Bed,
    iconColor: "bg-muted text-muted-foreground"
  },
];

// Chart data
const departmentData = [
  { name: 'Cardio', patients: 45, consultations: 32 },
  { name: 'Neuro', patients: 28, consultations: 20 },
  { name: 'Pédia', patients: 35, consultations: 28 },
  { name: 'Urgences', patients: 62, consultations: 55 },
  { name: 'Chirurgie', patients: 22, consultations: 18 },
];

const appointmentStatusData = [
  { name: 'Confirmés', value: mockAppointments.filter(a => a.status === 'confirmed').length, color: '#10b981' },
  { name: 'En attente', value: mockAppointments.filter(a => a.status === 'pending').length, color: '#f59e0b' },
  { name: 'Annulés', value: mockAppointments.filter(a => a.status === 'cancelled').length, color: '#ef4444' },
  { name: 'Terminés', value: mockAppointments.filter(a => a.status === 'completed').length, color: '#6366f1' },
];

const weeklyData = [
  { jour: 'Lun', entrees: 12, sorties: 8 },
  { jour: 'Mar', entrees: 15, sorties: 10 },
  { jour: 'Mer', entrees: 18, sorties: 12 },
  { jour: 'Jeu', entrees: 14, sorties: 9 },
  { jour: 'Ven', entrees: 20, sorties: 15 },
  { jour: 'Sam', entrees: 8, sorties: 6 },
  { jour: 'Dim', entrees: 5, sorties: 4 },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground">Tableau de bord Administrateur</h1>
        <p className="mt-1 text-muted-foreground">
          Vue d'ensemble complète de l'activité hospitalière
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.title}
            {...stat}
            delay={index * 50}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Department activity */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Activité par département
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Bar dataKey="patients" fill="hsl(var(--primary))" name="Patients" radius={[4, 4, 0, 0]} />
                <Bar dataKey="consultations" fill="hsl(var(--accent))" name="Consultations" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Appointment status pie */}
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
                <Pie
                  data={appointmentStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {appointmentStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Weekly flow chart */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Flux hebdomadaire (Entrées/Sorties)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="jour" />
              <YAxis />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
              <Legend />
              <Line type="monotone" dataKey="entrees" stroke="hsl(var(--success))" strokeWidth={2} name="Entrées" />
              <Line type="monotone" dataKey="sorties" stroke="hsl(var(--accent))" strokeWidth={2} name="Sorties" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Activity and appointments */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity />
        <UpcomingAppointments />
      </div>
    </div>
  );
}