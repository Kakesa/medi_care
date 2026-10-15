import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BedDouble, Users, Wrench, Clock, CheckCircle,
  UserPlus, UserMinus, History, TrendingUp, Plus, Pencil, Trash2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { bedTypeLabels, bedStatusLabels, departments } from "@/data/mockData";
import { bedService } from "@/services/bedService";
import { patientService } from "@/services/patientService";
import { apiMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import type { Bed, BedOccupation, BedStatus, BedType, Patient, Ward } from "@/types";

const statusColors: Record<BedStatus, string> = {
  available: "bg-green-500",
  occupied: "bg-red-500",
  maintenance: "bg-yellow-500",
  reserved: "bg-blue-500",
};

const statusBadgeVariant: Record<BedStatus, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  occupied: "destructive",
  maintenance: "outline",
  reserved: "secondary",
};

const bedTypes = Object.keys(bedTypeLabels) as BedType[];

const emptyWard = { name: "", floor: "1", department: "" };
const emptyBed = { number: "", wardId: "", type: "standard" as BedType, notes: "", status: "available" as Exclude<BedStatus, "occupied">, expectedDischarge: "" };

export default function BedManagement() {
  const { toast } = useToast();
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [occupations, setOccupations] = useState<BedOccupation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWard, setSelectedWard] = useState("all");
  const [wardDialog, setWardDialog] = useState<{ id?: string } & typeof emptyWard | null>(null);
  const [bedDialog, setBedDialog] = useState<{ id?: string; occupied?: boolean } & typeof emptyBed | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ bedId: string | null; patientId: string; expectedDischarge: string }>({
    bedId: null,
    patientId: "",
    expectedDischarge: "",
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [wardRows, bedRows, occupationRows, patientPage] = await Promise.all([
        bedService.getWards(),
        bedService.listAll(),
        bedService.listOccupations(),
        patientService.getAll({ limit: 100 }),
      ]);
      setWards(wardRows);
      setBeds(bedRows);
      setOccupations(occupationRows);
      setPatients(patientPage.data.filter((patient) => patient.status !== "discharged"));
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fail = (reason: unknown) => {
    toast({ variant: "destructive", title: "Opération impossible", description: apiMessage(reason) });
  };

  const filteredBeds = useMemo(() => {
    if (selectedWard === "all") return beds;
    return beds.filter((bed) => bed.wardId === selectedWard);
  }, [beds, selectedWard]);

  const stats = useMemo(() => {
    const total = beds.length;
    const available = beds.filter((bed) => bed.status === "available").length;
    const occupied = beds.filter((bed) => bed.status === "occupied").length;
    const maintenance = beds.filter((bed) => bed.status === "maintenance").length;
    const reserved = beds.filter((bed) => bed.status === "reserved").length;
    return { total, available, occupied, maintenance, reserved, occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0 };
  }, [beds]);

  const wardStats = useMemo(() => {
    return wards.map((ward) => {
      const wardBeds = beds.filter((bed) => bed.wardId === ward.id);
      const occupied = wardBeds.filter((bed) => bed.status === "occupied").length;
      const available = wardBeds.filter((bed) => bed.status === "available").length;
      return { ...ward, bedsCount: wardBeds.length, occupied, available, rate: wardBeds.length > 0 ? Math.round((occupied / wardBeds.length) * 100) : 0 };
    });
  }, [beds, wards]);

  const wardOccupancyData = useMemo(
    () => wardStats.map((ward) => ({ name: ward.name, Occupés: ward.occupied, Disponibles: ward.available })),
    [wardStats]
  );

  const monthKey = new Date().toISOString().slice(0, 7);
  const completedStays = occupations.filter((stay) => stay.status === "completed");
  const avgStay = completedStays.length
    ? Math.round(completedStays.reduce((sum, stay) => sum + stay.durationDays, 0) / completedStays.length)
    : 0;
  const dischargesThisMonth = completedStays.filter((stay) => stay.dischargeDate?.startsWith(monthKey)).length;

  const saveWard = async () => {
    if (!wardDialog) return;
    const payload = {
      name: wardDialog.name.trim(),
      floor: Number(wardDialog.floor),
      department: wardDialog.department.trim(),
    };
    try {
      if (wardDialog.id) {
        await bedService.updateWard(wardDialog.id, payload);
        toast({ title: "Service mis à jour" });
      } else {
        await bedService.createWard(payload);
        toast({ title: "Service créé" });
      }
      setWardDialog(null);
      await load();
    } catch (reason) {
      fail(reason);
    }
  };

  const removeWard = async (ward: Ward) => {
    if (!window.confirm(`Supprimer le service ${ward.name} ?`)) return;
    try {
      await bedService.deleteWard(ward.id);
      toast({ title: "Service supprimé" });
      await load();
    } catch (reason) {
      fail(reason);
    }
  };

  const saveBed = async () => {
    if (!bedDialog) return;
    try {
      if (bedDialog.id) {
        await bedService.update(bedDialog.id, {
          ...(bedDialog.occupied ? {} : {
            number: bedDialog.number.trim(),
            wardId: bedDialog.wardId,
            status: bedDialog.status,
          }),
          type: bedDialog.type,
          notes: bedDialog.notes.trim(),
          expectedDischarge: bedDialog.expectedDischarge,
        });
        toast({ title: "Lit mis à jour" });
      } else {
        await bedService.create({
          number: bedDialog.number.trim(),
          wardId: bedDialog.wardId,
          type: bedDialog.type,
          notes: bedDialog.notes.trim() || undefined,
        });
        toast({ title: "Lit créé" });
      }
      setBedDialog(null);
      await load();
    } catch (reason) {
      fail(reason);
    }
  };

  const removeBed = async (bed: Bed) => {
    if (!window.confirm(`Supprimer le lit ${bed.number} ?`)) return;
    try {
      await bedService.delete(bed.id);
      toast({ title: "Lit supprimé" });
      await load();
    } catch (reason) {
      fail(reason);
    }
  };

  const assignBed = async () => {
    if (!assignDialog.bedId || !assignDialog.patientId) return;
    try {
      await bedService.assign(assignDialog.bedId, {
        patientId: assignDialog.patientId,
        expectedDischarge: assignDialog.expectedDischarge || undefined,
      });
      setAssignDialog({ bedId: null, patientId: "", expectedDischarge: "" });
      toast({ title: "Lit attribué" });
      await load();
    } catch (reason) {
      fail(reason);
    }
  };

  const releaseBed = async (bedId: string) => {
    try {
      await bedService.release(bedId);
      toast({ title: "Lit libéré" });
      await load();
    } catch (reason) {
      fail(reason);
    }
  };

  const toggleMaintenance = async (bed: Bed) => {
    try {
      await bedService.update(bed.id, { status: bed.status === "maintenance" ? "available" : "maintenance" });
      await load();
    } catch (reason) {
      fail(reason);
    }
  };

  const openBedEditor = (bed: Bed) => {
    setBedDialog({
      id: bed.id,
      occupied: bed.status === "occupied",
      number: bed.number,
      wardId: bed.wardId,
      type: bed.type,
      notes: bed.notes ?? "",
      status: bed.status === "occupied" ? "available" : bed.status,
      expectedDischarge: bed.expectedDischarge ?? "",
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des lits</h1>
          <p className="text-muted-foreground mt-1">Services, lits et occupation de votre établissement</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWardDialog({ ...emptyWard })}>
            <Plus className="mr-2 h-4 w-4" />Nouveau service
          </Button>
          <Button variant="hero" onClick={() => setBedDialog({ ...emptyBed, wardId: wards[0]?.id ?? "" })} disabled={wards.length === 0}>
            <Plus className="mr-2 h-4 w-4" />Nouveau lit
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total lits", value: stats.total, icon: BedDouble, color: "text-foreground" },
          { label: "Disponibles", value: stats.available, icon: CheckCircle, color: "text-green-500" },
          { label: "Occupés", value: stats.occupied, icon: Users, color: "text-red-500" },
          { label: "Maintenance", value: stats.maintenance, icon: Wrench, color: "text-yellow-500" },
          { label: "Réservés", value: stats.reserved, icon: Clock, color: "text-blue-500" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <item.icon className={`h-8 w-8 ${item.color}`} />
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
          {!isLoading && wards.length === 0 && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Aucun service. Créez un service avant d’ajouter des lits.</CardContent></Card>
          )}
          {wardStats.map((ward) => {
            const wardBeds = beds.filter((bed) => bed.wardId === ward.id);
            return (
              <Card key={ward.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">{ward.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">Étage {ward.floor} • {ward.department} • {ward.occupied}/{ward.bedsCount} occupés</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={ward.rate} className="w-24 h-2" />
                      <span className="text-sm font-medium w-10 text-right">{ward.rate}%</span>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setWardDialog({ id: ward.id, name: ward.name, floor: String(ward.floor), department: ward.department })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void removeWard(ward)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {wardBeds.length === 0 && <p className="text-sm text-muted-foreground">Aucun lit dans ce service.</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {wardBeds.map((bed) => (
                      <div key={bed.id} className="relative group rounded-xl border border-border p-3 text-center transition-all duration-200 hover:shadow-md">
                        <div className={`absolute top-2 right-2 h-2.5 w-2.5 rounded-full ${statusColors[bed.status]}`} />
                        <BedDouble className={`h-6 w-6 mx-auto mb-1 ${bed.status === "occupied" ? "text-red-500" : bed.status === "available" ? "text-green-500" : "text-muted-foreground"}`} />
                        <p className="text-sm font-semibold">{bed.number}</p>
                        <p className="text-[10px] text-muted-foreground">{bedTypeLabels[bed.type]}</p>
                        {bed.patientName && <p className="text-[10px] text-foreground mt-1 truncate">{bed.patientName}</p>}
                        <div className="mt-2 flex flex-wrap justify-center gap-1">
                          {(bed.status === "available" || bed.status === "reserved") && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAssignDialog({ bedId: bed.id, patientId: "", expectedDischarge: "" })}>
                              <UserPlus className="h-3 w-3 mr-1" />Attribuer
                            </Button>
                          )}
                          {bed.status === "occupied" && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => void releaseBed(bed.id)}>
                              <UserMinus className="h-3 w-3 mr-1" />Libérer
                            </Button>
                          )}
                          {(bed.status === "available" || bed.status === "maintenance") && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void toggleMaintenance(bed)}>
                              <Wrench className="h-3 w-3 mr-1" />{bed.status === "maintenance" ? "Dispo" : "Maint."}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openBedEditor(bed)}>
                            <Pencil className="h-3 w-3 mr-1" />Modifier
                          </Button>
                          {bed.status !== "occupied" && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void removeBed(bed)}>
                              <Trash2 className="h-3 w-3 mr-1" />Supprimer
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
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Tous les lits</CardTitle>
                <Select value={selectedWard} onValueChange={setSelectedWard}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les services</SelectItem>
                    {wards.map((ward) => (
                      <SelectItem key={ward.id} value={ward.id}>{ward.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredBeds.length === 0 && <p className="text-sm text-muted-foreground">Aucun lit à afficher.</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredBeds.map((bed) => (
                  <div key={bed.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
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
                      {(bed.status === "available" || bed.status === "reserved") && (
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setAssignDialog({ bedId: bed.id, patientId: "", expectedDischarge: "" })}>
                          <UserPlus className="h-3 w-3" />
                        </Button>
                      )}
                      {bed.status === "occupied" && (
                        <Button size="icon" variant="outline" className="h-7 w-7 text-red-600" onClick={() => void releaseBed(bed.id)}>
                          <UserMinus className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => openBedEditor(bed)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {bed.status !== "occupied" && (
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => void removeBed(bed)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Durée moy. de séjour</p>
                  <p className="text-2xl font-bold">{avgStay} jours</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center"><Users className="h-5 w-5 text-green-500" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Patients hospitalisés</p>
                  <p className="text-2xl font-bold">{stats.occupied}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><History className="h-5 w-5 text-blue-500" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Sorties ce mois</p>
                  <p className="text-2xl font-bold">{dischargesThisMonth}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Occupation par service</CardTitle></CardHeader>
            <CardContent>
              {wardOccupancyData.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée d’occupation.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={wardOccupancyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Occupés" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Disponibles" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Historique d'occupation</CardTitle>
            </CardHeader>
            <CardContent>
              {occupations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune occupation enregistrée.</p>
              ) : (
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
                    {occupations.map((stay) => (
                      <TableRow key={stay.id}>
                        <TableCell className="font-semibold">{stay.bedNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{stay.wardName}</TableCell>
                        <TableCell>{stay.patientName}</TableCell>
                        <TableCell className="text-muted-foreground">{stay.admissionDate}</TableCell>
                        <TableCell className="text-muted-foreground">{stay.dischargeDate || "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{stay.durationDays} jour{stay.durationDays > 1 ? "s" : ""}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={stay.status === "active" ? "default" : "outline"}>
                            {stay.status === "active" ? "En cours" : "Terminé"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!wardDialog} onOpenChange={(open) => !open && setWardDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{wardDialog?.id ? "Modifier le service" : "Nouveau service"}</DialogTitle></DialogHeader>
          {wardDialog && (
            <div className="space-y-3">
              <div className="space-y-2"><Label>Nom</Label><Input value={wardDialog.name} onChange={(event) => setWardDialog({ ...wardDialog, name: event.target.value })} /></div>
              <div className="space-y-2"><Label>Étage</Label><Input type="number" min={0} value={wardDialog.floor} onChange={(event) => setWardDialog({ ...wardDialog, floor: event.target.value })} /></div>
              <div className="space-y-2">
                <Label>Département</Label>
                <Input list="ward-departments" value={wardDialog.department} onChange={(event) => setWardDialog({ ...wardDialog, department: event.target.value })} />
                <datalist id="ward-departments">{departments.map((department) => <option key={department} value={department} />)}</datalist>
              </div>
              <Button className="w-full" onClick={() => void saveWard()} disabled={wardDialog.name.trim().length < 2 || wardDialog.department.trim().length < 2}>Enregistrer</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!bedDialog} onOpenChange={(open) => !open && setBedDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{bedDialog?.id ? "Modifier le lit" : "Nouveau lit"}</DialogTitle></DialogHeader>
          {bedDialog && (
            <div className="space-y-3">
              <div className="space-y-2"><Label>Numéro</Label><Input value={bedDialog.number} disabled={bedDialog.occupied} onChange={(event) => setBedDialog({ ...bedDialog, number: event.target.value })} placeholder="A-101" /></div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={bedDialog.wardId} onValueChange={(wardId) => setBedDialog({ ...bedDialog, wardId })} disabled={bedDialog.occupied}>
                  <SelectTrigger><SelectValue placeholder="Choisir un service" /></SelectTrigger>
                  <SelectContent>
                    {wards.map((ward) => <SelectItem key={ward.id} value={ward.id}>{ward.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={bedDialog.type} onValueChange={(type: BedType) => setBedDialog({ ...bedDialog, type })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {bedTypes.map((type) => <SelectItem key={type} value={type}>{bedTypeLabels[type]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {bedDialog.id && !bedDialog.occupied && (
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={bedDialog.status} onValueChange={(status: Exclude<BedStatus, "occupied">) => setBedDialog({ ...bedDialog, status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Disponible</SelectItem>
                      <SelectItem value="reserved">Réservé</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Sortie prévue</Label>
                <Input type="date" value={bedDialog.expectedDischarge} onChange={(event) => setBedDialog({ ...bedDialog, expectedDischarge: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={bedDialog.notes} onChange={(event) => setBedDialog({ ...bedDialog, notes: event.target.value })} />
              </div>
              <Button className="w-full" onClick={() => void saveBed()} disabled={!bedDialog.number.trim() || !bedDialog.wardId}>Enregistrer</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignDialog.bedId} onOpenChange={(open) => !open && setAssignDialog({ bedId: null, patientId: "", expectedDischarge: "" })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Attribuer le lit {beds.find((bed) => bed.id === assignDialog.bedId)?.number}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select key={assignDialog.bedId ?? "none"} onValueChange={(patientId) => setAssignDialog({ ...assignDialog, patientId })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un patient" /></SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sortie prévue</Label>
              <Input type="date" value={assignDialog.expectedDischarge} onChange={(event) => setAssignDialog({ ...assignDialog, expectedDischarge: event.target.value })} />
            </div>
            <Button onClick={() => void assignBed()} disabled={!assignDialog.patientId}>Confirmer l'attribution</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            {(Object.keys(statusColors) as BedStatus[]).map((status) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${statusColors[status]}`} />
                <span className="text-muted-foreground">{bedStatusLabels[status]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
