import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, FileDown, RotateCcw, Search } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAckInvoices } from "@/contexts/WorkBadgeContext";
import { apiMessage } from "@/lib/apiError";
import { formatMoney } from "@/lib/money";
import { useAuth } from "@/contexts/AuthContext";
import { billingService, type CashMovement, type CashflowReport } from "@/services/billingService";
import { generateCashflowPDF } from "@/utils/pdfGenerator";

const COLORS = ["#22c55e", "#16a34a", "#15803d", "#0f766e", "#059669", "#14532d"];
const PAYMENT: Record<string, string> = {
  cash: "Espèces",
  card: "Carte",
  transfer: "Virement",
  insurance: "Assurance",
  other: "Autre",
};

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function todayRange() {
  const today = isoDate(new Date());
  return { from: today, to: today };
}

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: isoDate(monday), to: isoDate(sunday) };
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: isoDate(start), to: isoDate(now) };
}

function when(value: string) {
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function isEmpty(report: CashflowReport) {
  return !report.entries.length && !report.exits.length && !report.pending.length && !report.cancelled.length;
}

function MovementTable({ rows, empty, showService }: { rows: CashMovement[]; empty: string; showService: boolean }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          {showService && <TableHead>Service</TableHead>}
          <TableHead>Référence</TableHead>
          <TableHead>Désignation</TableHead>
          <TableHead>Catégorie</TableHead>
          <TableHead>Paiement</TableHead>
          <TableHead>Utilisateur</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.service}-${row.source}-${row.id}`}>
            <TableCell className="whitespace-nowrap text-muted-foreground">{when(row.at)}</TableCell>
            {showService && <TableCell>{row.serviceLabel}</TableCell>}
            <TableCell>{row.reference}</TableCell>
            <TableCell className="max-w-[220px] truncate font-medium">{row.label}</TableCell>
            <TableCell><Badge variant="secondary">{row.category}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">{row.paymentMethod ? PAYMENT[row.paymentMethod] || row.paymentMethod : "—"}</TableCell>
            <TableCell className="text-sm">{row.actorName}</TableCell>
            <TableCell className={`text-right font-semibold ${row.direction === "in" ? "text-green-600" : "text-red-600"}`}>
              {formatMoney(row.amount, row.currency)}
            </TableCell>
            <TableCell><Badge variant={row.status === "paid" ? "default" : row.status === "cancelled" ? "destructive" : "outline"}>{row.statusLabel}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function CashflowJournal({ serviceLock, title = "Comptabilité" }: { serviceLock?: "reception" | "pharmacy"; title?: string }) {
  const initial = monthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [applied, setApplied] = useState(initial);
  const [service, setService] = useState<"reception" | "pharmacy" | "all">(serviceLock || "all");
  const activeService = serviceLock || service;
  const [report, setReport] = useState<CashflowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useAckInvoices((report?.pending || []).flatMap((row) => (row.source === "invoice" ? [row.id] : [])));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await billingService.getCashflow(applied.from, applied.to, activeService);
        if (!cancelled) setReport(data);
      } catch (error) {
        if (!cancelled) toast.error(apiMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applied, activeService]);

  const apply = (next = { from, to }) => {
    if (!next.from || !next.to || next.from > next.to) {
      toast.error("La date de fin précède la date de début.");
      return;
    }
    setFrom(next.from);
    setTo(next.to);
    setApplied(next);
  };

  const matches = (row: CashMovement) => {
    const needle = search.trim().toLocaleLowerCase("fr");
    if (!needle) return true;
    return `${row.reference} ${row.label} ${row.category} ${row.actorName}`.toLocaleLowerCase("fr").includes(needle);
  };

  const entries = useMemo(() => (report?.entries || []).filter(matches), [report, search]);
  const exits = useMemo(() => (report?.exits || []).filter(matches), [report, search]);
  const aside = useMemo(() => [...(report?.pending || []), ...(report?.cancelled || [])].filter(matches), [report, search]);
  const currency = report?.currency || "EUR";
  const showService = report?.service === "all";
  const fieldId = serviceLock || "admin";

  const exportPdf = () => {
    if (!report || isEmpty(report)) {
      toast.error("Aucune opération enregistrée sur cette période.");
      return;
    }
    generateCashflowPDF({ ...report, generatedAt: new Date().toISOString() });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-muted-foreground">
            {serviceLock === "pharmacy"
              ? "Ventes, encaissements et dépenses de la pharmacie"
              : serviceLock === "reception"
                ? "Paiements des consultations, examens et autres prestations de la réception"
                : "Vue de la réception, de la pharmacie, ou des deux services ensemble"}
          </p>
        </div>
        <Button type="button" onClick={exportPdf} disabled={loading}>
          <FileDown className="mr-2 h-4 w-4" />Exporter en PDF
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_auto_auto_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor={`cash-from-${fieldId}`}>Date de début</Label>
            <Input id={`cash-from-${fieldId}`} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`cash-to-${fieldId}`}>Date de fin</Label>
            <Input id={`cash-to-${fieldId}`} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <Button type="button" onClick={() => apply()}>Filtrer</Button>
          <Button type="button" variant="outline" onClick={() => apply(monthRange())}>
            <RotateCcw className="mr-2 h-4 w-4" />Réinitialiser
          </Button>
          {!serviceLock && (
            <div className="flex flex-wrap gap-2 lg:col-span-5">
              <Button type="button" variant={service === "all" ? "default" : "outline"} onClick={() => setService("all")}>Tous les services</Button>
              <Button type="button" variant={service === "reception" ? "default" : "outline"} onClick={() => setService("reception")}>Réception</Button>
              <Button type="button" variant={service === "pharmacy" ? "default" : "outline"} onClick={() => setService("pharmacy")}>Pharmacie</Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => apply(todayRange())}>Jour</Button>
            <Button type="button" variant="secondary" onClick={() => apply(weekRange())}>Semaine</Button>
            <Button type="button" variant="secondary" onClick={() => apply(monthRange())}>Mois</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="flex items-center gap-3 p-4">
            <ArrowUpCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total des entrées</p>
              <p className="text-xl font-bold text-green-600">{formatMoney(report?.totals.income || 0, currency)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="flex items-center gap-3 p-4">
            <ArrowDownCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total des sorties</p>
              <p className="text-xl font-bold text-red-600">{formatMoney(report?.totals.expense || 0, currency)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Solde de la période</p>
            <p className={`text-xl font-bold ${(report?.totals.balance || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatMoney(report?.totals.balance || 0, currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {report && report.incomeByCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Entrées par catégorie</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={report.incomeByCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {report.incomeByCategory.map((row, index) => <Cell key={row.category} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatMoney(value, currency)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher une référence, une désignation ou un utilisateur" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement des mouvements...</p>
      ) : report && isEmpty(report) ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Aucune opération enregistrée sur cette période.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Entrées ({entries.length})</CardTitle></CardHeader>
            <CardContent><MovementTable rows={entries} empty="Aucune entrée encaissée sur cette période." showService={showService} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Sorties ({exits.length})</CardTitle></CardHeader>
            <CardContent><MovementTable rows={exits} empty="Aucune sortie payée sur cette période." showService={showService} /></CardContent>
          </Card>
          {aside.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Hors solde ({aside.length})</CardTitle>
                <p className="text-sm text-muted-foreground">Factures non payées, dépenses en attente et opérations annulées. Elles ne sont pas comptées dans le solde.</p>
              </CardHeader>
              <CardContent><MovementTable rows={aside} empty="" showService={showService} /></CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function Accounting() {
  const { user } = useAuth();
  const serviceLock = user?.role === "HOSPITAL_ADMIN" ? undefined : "reception" as const;
  return <CashflowJournal serviceLock={serviceLock} />;
}
