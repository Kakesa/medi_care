import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { formatMoney } from "@/lib/money";
import { billingService } from "@/services/billingService";
import type { Invoice } from "@/types";

function totalLabel(rows: Invoice[]) {
  const currencies = [...new Set(rows.map((row) => row.currency || "EUR"))];
  if (currencies.length !== 1) return null;
  const sum = rows.reduce((total, row) => total + row.total, 0);
  return formatMoney(sum, currencies[0]);
}

function InvoiceList({ rows, empty }: { rows: Invoice[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <Card className="card-elevated">
        <CardContent className="py-12 text-center">
          <FileText className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{empty}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((invoice) => (
        <Card key={invoice.id} className="card-elevated">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{invoice.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground">
                  Émise le {new Date(invoice.createdAt).toLocaleDateString("fr-FR")}
                  {invoice.status === "paid" && invoice.paidAt
                    ? ` · Payée le ${new Date(invoice.paidAt).toLocaleDateString("fr-FR")}`
                    : ` · Échéance ${invoice.dueDate}`}
                </p>
              </div>
              <div className="text-right">
                <Badge variant={invoice.status === "paid" ? "default" : invoice.status === "overdue" ? "destructive" : "secondary"}>
                  {invoice.status === "paid" ? "Payée" : invoice.status === "overdue" ? "En retard" : "À payer"}
                </Badge>
                <p className="mt-1 font-semibold">{formatMoney(invoice.total, invoice.currency || "EUR")}</p>
              </div>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {invoice.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>{item.description}</span>
                  <span className="shrink-0">{formatMoney(item.total, invoice.currency || "EUR")}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PatientInvoices() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setInvoices(await billingService.getMyInvoices());
      } catch (error) {
        toast({ variant: "destructive", title: "Factures indisponibles", description: apiMessage(error) });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [toast]);

  const payable = useMemo(
    () => invoices.filter((invoice) => invoice.status === "pending" || invoice.status === "overdue"),
    [invoices],
  );
  const paid = useMemo(
    () => invoices.filter((invoice) => invoice.status === "paid"),
    [invoices],
  );
  const dueLabel = totalLabel(payable);
  const paidLabel = totalLabel(paid);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Facture</h1>
        <p className="mt-1 text-muted-foreground">Les factures à régler et celles déjà payées.</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement des factures...</p>
      ) : (
        <Tabs defaultValue="due">
          <TabsList>
            <TabsTrigger value="due">
              À payer ({payable.length}{dueLabel ? ` · ${dueLabel}` : ""})
            </TabsTrigger>
            <TabsTrigger value="paid">
              Déjà payées ({paid.length}{paidLabel ? ` · ${paidLabel}` : ""})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="due" className="mt-4">
            <InvoiceList rows={payable} empty="Aucune facture à payer" />
          </TabsContent>
          <TabsContent value="paid" className="mt-4">
            <InvoiceList rows={paid} empty="Aucune facture payée" />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
