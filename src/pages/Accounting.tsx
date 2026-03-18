import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Search, Filter,
  ArrowUpCircle, ArrowDownCircle, CheckCircle, XCircle, Clock
} from "lucide-react";
import { mockFinancialMovements, movementCategories } from "@/data/mockData";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  validated: { label: "Validé", variant: "default" },
  cancelled: { label: "Annulé", variant: "destructive" },
};

const categoryLabels: Record<string, string> = {
  consultation: "Consultation",
  exam: "Examen",
  hospitalization: "Hospitalisation",
  medication: "Médicaments",
  insurance_reimbursement: "Remb. assurance",
  other_income: "Autre recette",
  salary: "Salaires",
  equipment: "Équipement",
  maintenance: "Maintenance",
  supplies: "Fournitures",
  utilities: "Charges",
  other_expense: "Autre dépense",
};

export default function Accounting() {
  const [movements, setMovements] = useState(mockFinancialMovements);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newMovement, setNewMovement] = useState({
    type: "income" as "income" | "expense",
    category: "",
    label: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    reference: "",
    patientName: "",
    notes: "",
  });

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      const matchSearch = m.label.toLowerCase().includes(search.toLowerCase()) ||
        (m.reference || "").toLowerCase().includes(search.toLowerCase()) ||
        (m.patientName || "").toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === "all" || m.type === filterType;
      const matchStatus = filterStatus === "all" || m.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });
  }, [movements, search, filterType, filterStatus]);

  const totals = useMemo(() => {
    const validated = movements.filter((m) => m.status === "validated");
    const income = validated.filter((m) => m.type === "income").reduce((s, m) => s + m.amount, 0);
    const expense = validated.filter((m) => m.type === "expense").reduce((s, m) => s + m.amount, 0);
    return { income, expense, balance: income - expense, pending: movements.filter(m => m.status === "pending").length };
  }, [movements]);

  const handleCreate = () => {
    if (!newMovement.label || !newMovement.amount || !newMovement.category) return;
    const movement = {
      id: `mov-${Date.now()}`,
      ...newMovement,
      amount: parseFloat(newMovement.amount),
      status: "pending" as const,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setMovements([movement, ...movements]);
    setIsDialogOpen(false);
    setNewMovement({ type: "income", category: "", label: "", amount: "", date: new Date().toISOString().split("T")[0], reference: "", patientName: "", notes: "" });
  };

  const handleValidate = (id: string) => {
    setMovements(movements.map((m) => m.id === id ? { ...m, status: "validated" as const, validatedBy: "Admin" } : m));
  };

  const handleCancel = (id: string) => {
    setMovements(movements.map((m) => m.id === id ? { ...m, status: "cancelled" as const } : m));
  };

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Comptabilité</h1>
          <p className="text-muted-foreground mt-1">Gestion des mouvements financiers</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nouveau mouvement</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Enregistrer un mouvement</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newMovement.type} onValueChange={(v) => setNewMovement({ ...newMovement, type: v as any, category: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Entrée</SelectItem>
                      <SelectItem value="expense">Sortie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select value={newMovement.category} onValueChange={(v) => setNewMovement({ ...newMovement, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>
                      {movementCategories[newMovement.type].map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Libellé</Label>
                <Input value={newMovement.label} onChange={(e) => setNewMovement({ ...newMovement, label: e.target.value })} placeholder="Description du mouvement" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Montant (€)</Label>
                  <Input type="number" step="0.01" value={newMovement.amount} onChange={(e) => setNewMovement({ ...newMovement, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={newMovement.date} onChange={(e) => setNewMovement({ ...newMovement, date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Référence</Label>
                  <Input value={newMovement.reference} onChange={(e) => setNewMovement({ ...newMovement, reference: e.target.value })} placeholder="N° facture, etc." />
                </div>
                <div className="space-y-2">
                  <Label>Patient (optionnel)</Label>
                  <Input value={newMovement.patientName} onChange={(e) => setNewMovement({ ...newMovement, patientName: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={newMovement.notes} onChange={(e) => setNewMovement({ ...newMovement, notes: e.target.value })} rows={2} />
              </div>
              <Button onClick={handleCreate} className="w-full">Enregistrer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total entrées</p>
              <p className="text-xl font-bold text-green-600">{fmt(totals.income)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total sorties</p>
              <p className="text-xl font-bold text-red-600">{fmt(totals.expense)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Solde</p>
              <p className={`text-xl font-bold ${totals.balance >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(totals.balance)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En attente</p>
              <p className="text-xl font-bold text-foreground">{totals.pending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="income">Entrées</SelectItem>
                <SelectItem value="expense">Sorties</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="validated">Validé</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Mouvements ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id} className="group">
                  <TableCell>
                    {m.type === "income" ? (
                      <ArrowUpCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.date}</TableCell>
                  <TableCell className="font-medium max-w-[250px] truncate">{m.label}</TableCell>
                  <TableCell><Badge variant="secondary">{categoryLabels[m.category] || m.category}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.reference || "—"}</TableCell>
                  <TableCell className={`text-right font-semibold ${m.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {m.type === "income" ? "+" : "-"}{fmt(m.amount)}
                  </TableCell>
                  <TableCell><Badge variant={statusConfig[m.status].variant}>{statusConfig[m.status].label}</Badge></TableCell>
                  <TableCell>
                    {m.status === "pending" && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleValidate(m.id)}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleCancel(m.id)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun mouvement trouvé</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
