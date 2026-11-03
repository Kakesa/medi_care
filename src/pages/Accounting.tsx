import { useEffect, useMemo, useState } from "react";
import { ArrowUpCircle, Clock, PieChart as PieChartIcon, Search, TrendingUp } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAckInvoices } from "@/contexts/WorkBadgeContext";
import { apiMessage } from "@/lib/apiError";
import { categoryLabel, DEFAULT_CATEGORIES, type BillingCategory } from "@/lib/billingCategories";
import { formatMoney, type BillingCurrency } from "@/lib/money";
import { billingService } from "@/services/billingService";
import type { Invoice, InvoiceStatus } from "@/types";

const OPEN_STATUSES = new Set<InvoiceStatus>(["pending", "overdue"]);
const ENTRY_STATUSES = new Set<InvoiceStatus>(["paid", "pending", "overdue"]);
const COLORS = ["#22c55e", "#16a34a", "#15803d", "#0f766e", "#059669", "#14532d", "#65a30d", "#047857"];

const statusConfig: Record<"paid" | "pending" | "overdue", { label: string; variant: "default" | "secondary" | "destructive" }> = {
  paid: { label: "Encaissée", variant: "default" },
  pending: { label: "À encaisser", variant: "secondary" },
  overdue: { label: "En retard", variant: "destructive" },
};

const paymentLabels: Record<string, string> = {
  cash: "Espèces",
  card: "Carte",
  transfer: "Virement",
  insurance: "Assurance",
};

async function loadByStatus(status: InvoiceStatus) {
  const first = await billingService.getInvoices({ status, limit: 100, page: 1 });
  const rows = [...first.data];
  const pages = Math.min(first.totalPages || 1, 5);
  for (let page = 2; page <= pages; page += 1) {
    const next = await billingService.getInvoices({ status, limit: 100, page });
    rows.push(...next.data);
  }
  return rows;
}

function moneyOf(invoice: Invoice) {
  return invoice.currency || "EUR";
}

function when(invoice: Invoice) {
  const raw = invoice.status === "paid" && invoice.paidAt ? invoice.paidAt : invoice.createdAt;
  return new Date(raw).toLocaleDateString("fr-FR");
}

function categoriesOf(invoice: Invoice, categories: BillingCategory[]) {
  const codes = [...new Set(invoice.items.map((item) => item.category || "AUTRE"))];
  if (!codes.length) return "Autre";
  return codes.map((code) => categoryLabel(categories, code)).join(", ");
}

export default function Accounting() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currency, setCurrency] = useState<BillingCurrency>("EUR");
  const [categories, setCategories] = useState<BillingCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useAckInvoices(invoices.flatMap((invoice) => (OPEN_STATUSES.has(invoice.status) ? [invoice.id] : [])));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [settings, paid, pending, overdue] = await Promise.all([
          billingService.getSettings(),
          loadByStatus("paid"),
          loadByStatus("pending"),
          loadByStatus("overdue"),
        ]);
        if (cancelled) return;
        setCurrency(settings.currency);
        setCategories(settings.categories?.length ? settings.categories : DEFAULT_CATEGORIES);
        setInvoices([...paid, ...pending, ...overdue]);
      } catch (error) {
        if (!cancelled) toast.error(apiMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo(
    () => invoices.filter((invoice) => ENTRY_STATUSES.has(invoice.status)),
    [invoices],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("fr");
    return entries.filter((invoice) => {
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      const haystack = `${invoice.invoiceNumber} ${invoice.patientName} ${invoice.paymentReference || ""}`.toLocaleLowerCase("fr");
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [entries, search, statusFilter]);

  const inCurrency = (invoice: Invoice) => moneyOf(invoice) === currency;
  const sum = (status: InvoiceStatus) => entries
    .filter((invoice) => invoice.status === status && inCurrency(invoice))
    .reduce((total, invoice) => total + invoice.total, 0);

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    entries
      .filter((invoice) => invoice.status === "paid" && inCurrency(invoice))
      .forEach((invoice) => {
        const items = invoice.items.filter((item) => item.total > 0);
        if (!items.length) {
          const label = "Autre";
          map[label] = (map[label] || 0) + invoice.total;
          return;
        }
        items.forEach((item) => {
          const label = categoryLabel(categories, item.category || "AUTRE");
          map[label] = (map[label] || 0) + item.total;
        });
      });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [entries, categories, currency]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Comptabilité</h1>
        <p className="mt-1 text-muted-foreground">Entrées réelles issues des factures de l'hôpital</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Encaissé</p>
              <p className="text-xl font-bold text-green-600">{formatMoney(sum("paid"), currency)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">À encaisser</p>
              <p className="text-xl font-bold">{formatMoney(sum("pending"), currency)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <ArrowUpCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En retard</p>
              <p className="text-xl font-bold text-red-600">{formatMoney(sum("overdue"), currency)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="h-4 w-4 text-green-500" />
            Entrées encaissées par catégorie
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incomeByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={incomeByCategory} cx="50%" cy="50%" outerRadius={88} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {incomeByCategory.map((row, index) => (
                    <Cell key={row.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatMoney(value, currency)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune entrée encaissée</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Patient, facture ou référence" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les entrées</SelectItem>
              <SelectItem value="paid">Encaissées</SelectItem>
              <SelectItem value="pending">À encaisser</SelectItem>
              <SelectItem value="overdue">En retard</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Entrées ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chargement des entrées...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((invoice) => {
                  const status = invoice.status as "paid" | "pending" | "overdue";
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="text-muted-foreground">{when(invoice)}</TableCell>
                      <TableCell className="font-medium">{invoice.patientName}</TableCell>
                      <TableCell>{invoice.invoiceNumber}</TableCell>
                      <TableCell><Badge variant="secondary">{categoriesOf(invoice, categories)}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {invoice.paymentMethod ? paymentLabels[invoice.paymentMethod] || invoice.paymentMethod : "—"}
                        {invoice.paymentReference ? ` · ${invoice.paymentReference}` : ""}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatMoney(invoice.total, moneyOf(invoice))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[status].variant}>{statusConfig[status].label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Aucune entrée pour ce filtre</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
