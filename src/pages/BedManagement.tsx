import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BedDouble, Users, Wrench, Clock, CheckCircle,
  UserPlus, UserMinus, History, TrendingUp
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from "recharts";
import { mockBeds, mockWards, mockPatients, bedTypeLabels, bedStatusLabels } from "@/data/mockData";
import type { Bed } from "@/data/mockData";

const statusColors: Record<string, string> = {
  available: "bg-green-500",
  occupied: "bg-red-500",
  maintenance: "bg-yellow-500",
  reserved: "bg-blue-500",
};

const statusBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  occupied: "destructive",
  maintenance: "outline",
  reserved: "secondary",
};

// Mock occupation history data
const mockOccupationHistory = [
  { id: "occ-1", bedNumber: "A-101", wardName: "Cardiologie A", patientName: "Jean Martin", admissionDate: "2024-01-10", dischargeDate: null, durationDays: 12, status: "active" },
  { id: "occ-2", bedNumber: "B-201", wardName: "Neurologie B", patientName: "Pierre Durand", admissionDate: "2024-01-05", dischargeDate: null, durationDays: 17, status: "active" },
  { id: "occ-3", bedNumber: "SI-01", wardName: "Soins intensifs", patientName: "Robert Moreau", admissionDate: "2024-01-21", dischargeDate: null, durationDays: 1, status: "active" },
  { id: "occ-4", bedNumber: "A-102", wardName: "Cardiologie A", patientName: "Michel Bernard", admissionDate: "2024-01-02", dischargeDate: "2024-01-18", durationDays: 16, status: "completed" },
  { id: "occ-5", bedNumber: "B-203", wardName: "Neurologie B", patientName: "Anne Lefebvre", admissionDate: "2023-12-28", dischargeDate: "2024-01-15", durationDays: 18, status: "completed" },
  { id: "occ-6", bedNumber: "C-101", wardName: "Pédiatrie C", patientName: "Lucas Petit", admissionDate: "2024-01-20", dischargeDate: null, durationDays: 2, status: "active" },
  { id: "occ-7", bedNumber: "D-301", wardName: "Maternité D", patientName: "Camille Rousseau", admissionDate: "2024-01-22", dischargeDate: null, durationDays: 0, status: "active" },
  { id: "occ-8", bedNumber: "E-203", wardName: "Chirurgie E", patientName: "François Blanc", admissionDate: "2024-01-17", dischargeDate: null, durationDays: 5, status: "active" },
  { id: "occ-9", bedNumber: "A-103", wardName: "Cardiologie A", patientName: "Claire Moreau", admissionDate: "2023-12-20", dischargeDate: "2024-01-08", durationDays: 19, status: "completed" },
  { id: "occ-10", bedNumber: "SI-02", wardName: "Soins intensifs", patientName: "Henri Dupuis", admissionDate: "2024-01-12", dischargeDate: "2024-01-19", durationDays: 7, status: "completed" },
];

// Weekly occupation rate data
const weeklyOccupationData = [
  { semaine: "Sem 1", Cardiologie: 62, Neurologie: 50, Pédiatrie: 30, "Soins intensifs": 75, Maternité: 25, Chirurgie: 33 },
  { semaine: "Sem 2", Cardiologie: 75, Neurologie: 67, Pédiatrie: 40, "Soins intensifs": 50, Maternité: 38, Chirurgie: 50 },
  { semaine: "Sem 3", Cardiologie: 50, Neurologie: 33, Pédiatrie: 20, "Soins intensifs": 100, Maternité: 50, Chirurgie: 67 },
  { semaine: "Sem 4", Cardiologie: 25, Neurologie: 67, Pédiatrie: 30, "Soins intensifs": 67, Maternité: 38, Chirurgie: 50 },
];

const LINE_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6"];

export default function BedManagement() {
  const [beds, setBeds] = useState<Bed[]>(mockBeds);
  const [selectedWard, setSelectedWard] = useState<string>("all");
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; bedId: string | null }>({ open: false, bedId: null });
  const [assignPatient, setAssignPatient] = useState({ patientName: "", expectedDischarge: "" });

  const filteredBeds = useMemo(() => {
    if (selectedWard === "all") return beds;
    return beds.filter((b) => b.wardId === selectedWard);
  }, [beds, selectedWard]);

  const stats = useMemo(() => {
    const total = beds.length;
    const available = beds.filter((b) => b.status === "available").length;
    const occupied = beds.filter((b) => b.status === "occupied").length;
    const maintenance = beds.filter((b) => b.status === "maintenance").length;
    const reserved = beds.filter((b) => b.status === "reserved").length;
    return { total, available, occupied, maintenance, reserved, occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0 };
  }, [beds]);

  const wardStats = useMemo(() => {
    return mockWards.map((w) => {
      const wardBeds = beds.filter((b) => b.wardId === w.id);
      const occupied = wardBeds.filter((b) => b.status === "occupied").length;
      const available = wardBeds.filter((b) => b.status === "available").length;
      return { ...w, bedsCount: wardBeds.length, occupied, available, rate: wardBeds.length > 0 ? Math.round((occupied / wardBeds.length) * 100) : 0 };
    });
  }, [beds]);

  // Bar chart data: occupancy by ward
  const wardOccupancyData = useMemo(() => {
    return wardStats.map((w) => ({
      name: w.name.replace(/\s[A-Z]$/, ""),
      Occupés: w.occupied,
      Disponibles: w.available,
      Total: w.bedsCount,
    }));
  }, [wardStats]);

  // Average stay duration
  const avgStay = useMemo(() => {
    const completed = mockOccupationHistory.filter((o) => o.status === "completed");
    if (completed.length === 0) return 0;
    return Math.round(completed.reduce((s, o) => s + o.durationDays, 0) / completed.length);
  }, []);

  const handleAssign = () => {
    if (!assignDialog.bedId || !assignPatient.patientName) return;
    setBeds(beds.map((b) =>
      b.id === assignDialog.bedId
        ? { ...b, status: "occupied" as const, patientName: assignPatient.patientName, admissionDate: new Date().toISOString().split("T")[0], expectedDischarge: assignPatient.expectedDischarge || undefined }
        : b
    ));
    setAssignDialog({ open: false, bedId: null });
    setAssignPatient({ patientName: "", expectedDischarge: "" });
  };

  const handleRelease = (bedId: string) => {
    setBeds(beds.map((b) =>
      b.id === bedId
        ? { ...b, status: "available" as const, patientId: undefined, patientName: undefined, admissionDate: undefined, expectedDischarge: undefined, notes: undefined }
        : b
    ));
  };

  const handleToggleMaintenance = (bedId: string) => {
    setBeds(beds.map((b) => {
      if (b.id !== bedId) return b;
      return b.status === "maintenance"
        ? { ...b, status: "available" as const, notes: undefined }
        : { ...b, status: "maintenance" as const };
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des lits</h1>
          <p className="text-muted-foreground mt-1">Vue d'ensemble de l'occupation hospitalière</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total lits", value: stats.total, icon: BedDouble, color: "text-foreground" },
          { label: "Disponibles", value: stats.available, icon: CheckCircle, color: "text-green-500" },
          { label: "Occupés", value: stats.occupied, icon: Users, color: "text-red-500" },
          { label: "Maintenance", value: stats.maintenance, icon: Wrench, color: "text-yellow-500" },
          { label: "Réservés", value: stats.reserved, icon: Clock, color: "text-blue-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Occupancy bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Taux d'occupation global</span>
            <span className="text-sm font-bold">{stats.occupancyRate}%</span>
          </div>
          <Progress value={stats.occupancyRate} className="h-3" />
        </CardContent>
      </Card>

      <Tabs defaultValue="visual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visual">Vue par service</TabsTrigger>
          <TabsTrigger value="list">Vue liste</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-4">
          {wardStats.map((ward) => {
            const wardBeds = beds.filter((b) => b.wardId === ward.id);
            return (
              <Card key={ward.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{ward.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">Étage {ward.floor} • {ward.department} • {ward.occupied}/{ward.bedsCount} occupés</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={ward.rate} className="w-24 h-2" />
                      <span className="text-sm font-medium w-10 text-right">{ward.rate}%</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {wardBeds.map((bed) => (
                      <div
                        key={bed.id}
                        className="relative group rounded-xl border border-border p-3 text-center transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                      >
                        <div className={`absolute top-2 right-2 h-2.5 w-2.5 rounded-full ${statusColors[bed.status]}`} />
                        <BedDouble className={`h-6 w-6 mx-auto mb-1 ${bed.status === "occupied" ? "text-red-500" : bed.status === "available" ? "text-green-500" : "text-muted-foreground"}`} />
                        <p className="text-sm font-semibold">{bed.number}</p>
                        <p className="text-[10px] text-muted-foreground">{bedTypeLabels[bed.type]}</p>
                        {bed.patientName && <p className="text-[10px] text-foreground mt-1 truncate">{bed.patientName}</p>}
                        <div className="absolute inset-0 bg-background/90 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                          {bed.status === "available" && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAssignDialog({ open: true, bedId: bed.id })}>
                              <UserPlus className="h-3 w-3 mr-1" />Attribuer
                            </Button>
                          )}
                          {bed.status === "occupied" && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => handleRelease(bed.id)}>
                              <UserMinus className="h-3 w-3 mr-1" />Libérer
                            </Button>
                          )}
                          {(bed.status === "available" || bed.status === "maintenance") && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleToggleMaintenance(bed.id)}>
                              <Wrench className="h-3 w-3 mr-1" />{bed.status === "maintenance" ? "Dispo" : "Maint."}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tous les lits</CardTitle>
                <Select value={selectedWard} onValueChange={setSelectedWard}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les services</SelectItem>
                    {mockWards.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredBeds.map((bed) => (
                  <div key={bed.id} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/30">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${bed.status === "occupied" ? "bg-red-500/10" : bed.status === "available" ? "bg-green-500/10" : bed.status === "reserved" ? "bg-blue-500/10" : "bg-yellow-500/10"}`}>
                      <BedDouble className={`h-5 w-5 ${bed.status === "occupied" ? "text-red-500" : bed.status === "available" ? "text-green-500" : bed.status === "reserved" ? "text-blue-500" : "text-yellow-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{bed.number}</span>
                        <Badge variant={statusBadgeVariant[bed.status]} className="text-[10px]">{bedStatusLabels[bed.status]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{bed.wardName} • {bedTypeLabels[bed.type]}</p>
                      {bed.patientName && <p className="text-xs text-foreground truncate">{bed.patientName}</p>}
                    </div>
                    <div className="flex gap-1">
                      {bed.status === "available" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAssignDialog({ open: true, bedId: bed.id })}>
                          <UserPlus className="h-3 w-3" />
                        </Button>
                      )}
                      {bed.status === "occupied" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => handleRelease(bed.id)}>
                          <UserMinus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Durée moy. de séjour</p>
                  <p className="text-2xl font-bold">{avgStay} jours</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Patients actifs</p>
                  <p className="text-2xl font-bold">{mockOccupationHistory.filter(o => o.status === "active").length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <History className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sorties ce mois</p>
                  <p className="text-2xl font-bold">{mockOccupationHistory.filter(o => o.status === "completed").length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Occupation par service</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={wardOccupancyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Occupés" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Disponibles" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Évolution du taux d'occupation (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={weeklyOccupationData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="semaine" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    {["Cardiologie", "Neurologie", "Pédiatrie", "Soins intensifs", "Maternité", "Chirurgie"].map((dept, i) => (
                      <Line key={dept} type="monotone" dataKey={dept} stroke={LINE_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historique d'occupation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lit</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Admission</TableHead>
                    <TableHead>Sortie</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockOccupationHistory.map((occ) => (
                    <TableRow key={occ.id}>
                      <TableCell className="font-semibold">{occ.bedNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{occ.wardName}</TableCell>
                      <TableCell>{occ.patientName}</TableCell>
                      <TableCell className="text-muted-foreground">{occ.admissionDate}</TableCell>
                      <TableCell className="text-muted-foreground">{occ.dischargeDate || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{occ.durationDays} jour{occ.durationDays > 1 ? "s" : ""}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={occ.status === "active" ? "default" : "outline"}>
                          {occ.status === "active" ? "En cours" : "Terminé"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(o) => setAssignDialog({ open: o, bedId: o ? assignDialog.bedId : null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Attribuer le lit {beds.find(b => b.id === assignDialog.bedId)?.number}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select onValueChange={(v) => setAssignPatient({ ...assignPatient, patientName: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un patient" /></SelectTrigger>
                <SelectContent>
                  {mockPatients.filter(p => p.status !== "discharged").map((p) => (
                    <SelectItem key={p.id} value={`${p.firstName} ${p.lastName}`}>{p.firstName} {p.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sortie prévue</Label>
              <Input type="date" value={assignPatient.expectedDischarge} onChange={(e) => setAssignPatient({ ...assignPatient, expectedDischarge: e.target.value })} />
            </div>
            <Button onClick={handleAssign} disabled={!assignPatient.patientName}>Confirmer l'attribution</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            {Object.entries(statusColors).map(([status, color]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${color}`} />
                <span className="text-muted-foreground">{bedStatusLabels[status]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}