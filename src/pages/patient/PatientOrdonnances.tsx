import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Pill, Printer, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { formatMoney } from "@/lib/money";
import {
  pharmacyStatusLabels,
  prescriptionService,
  type PatientPrescription,
  type PatientPrescriptionFilter,
} from "@/services/prescriptionService";
import { downloadOrdonnance, lineFromItem, printOrdonnance } from "@/utils/ordonnance";

const filters: Array<{ value: PatientPrescriptionFilter; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "awaiting_payment", label: "En attente de paiement" },
  { value: "paid", label: "Payées" },
  { value: "partial_dispense", label: "Partiellement délivrées" },
  { value: "delivered", label: "Entièrement délivrées" },
];

function paymentBadge(row: PatientPrescription) {
  if (row.paymentStatus === "paid") return "default" as const;
  if (row.paymentStatus === "cancelled") return "destructive" as const;
  if (row.paymentStatus === "awaiting_payment") return "secondary" as const;
  return "outline" as const;
}

function dispenseBadge(row: PatientPrescription) {
  if (row.dispenseStatus === "delivered") return "default" as const;
  if (row.dispenseStatus === "partial") return "secondary" as const;
  return "outline" as const;
}

function lineStatusLabel(status: PatientPrescription["items"][number]["lineDispenseStatus"]) {
  if (status === "delivered") return "Délivré";
  if (status === "partial") return "Partiellement délivré";
  if (status === "unavailable") return "Indisponible";
  return "En attente";
}

function sheetFromPrescription(row: PatientPrescription, organizationName: string) {
  return {
    organization: {
      name: row.organizationName || organizationName || "Établissement",
    },
    patientName: row.patientName,
    age: "—",
    sex: "—",
    recordNumber: row.reference,
    date: new Date(row.validatedAt || row.createdAt || Date.now()).toLocaleDateString("fr-FR"),
    doctorName: row.prescriberName,
    lines: row.items.map((item) => lineFromItem({
      medication: item.medication,
      dosage: item.dosage,
      posology: item.posology,
      form: item.formLabel || item.form,
      duration: item.duration,
      quantityPrescribed: item.quantityPrescribed,
      instructions: item.instructions,
    })),
    recommendations: row.recommendations || "",
  };
}

function openFinancialDocument(row: PatientPrescription, mode: "print" | "download") {
  const currency = row.quoteCurrency || "USD";
  const money = (value: number | null | undefined) =>
    value == null ? "—" : formatMoney(value, currency);
  const rows = row.items
    .map((item) => `
      <tr>
        <td>${item.medication}</td>
        <td style="text-align:right">${item.quantityPrescribed}</td>
        <td style="text-align:right">${money(item.unitPrice)}</td>
        <td style="text-align:right">${money(item.lineTotal)}</td>
      </tr>`)
    .join("");
  const title = row.quoteIsFinal ? "Récapitulatif financier" : "Estimation pharmaceutique (non définitive)";
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" /><title>${title}</title>
<style>
  body { font-family: Georgia, serif; margin: 24px; color: #111; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .note { color: #666; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
  th { background: #f7f7f7; }
  .total { font-weight: bold; font-size: 15px; margin-top: 16px; }
  .warn { background: #fff8e6; border: 1px solid #f0d78c; padding: 10px; margin: 12px 0; }
</style></head><body>
  <h1>${title}</h1>
  <p class="note">${row.organizationName || ""} · ${row.patientName} · Réf. ${row.reference}</p>
  <p>Médecin : ${row.prescriberName} · Date : ${new Date(row.validatedAt || row.createdAt || Date.now()).toLocaleDateString("fr-FR")}</p>
  ${row.quoteIsFinal ? "" : `<div class="warn">Montants estimatifs — en attente de validation par la pharmacie. Ce document n'est pas une facture définitive.</div>`}
  <table>
    <thead><tr><th>Médicament</th><th style="text-align:right">Quantité</th><th style="text-align:right">Prix unitaire</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="total">Montant total : ${money(row.amountDue)}</p>
  <p>Déjà payé : ${money(row.amountPaid)} · Reste à payer : ${money(row.amountRemaining)}</p>
  <p>Statut paiement : ${row.paymentStatusLabel}</p>
  ${row.invoice ? `<p>Facture ${row.invoice.invoiceNumber}${row.invoice.createdAt ? ` · ${new Date(row.invoice.createdAt).toLocaleDateString("fr-FR")}` : ""}</p>` : ""}
  <p class="note">Document financier distinct de l'ordonnance médicale.</p>
</body></html>`;

  if (mode === "print") {
    const popup = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
    if (!popup) return false;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
    return true;
  }

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `recap-financier-${row.reference}.html`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

function DetailView({
  row,
  organizationName,
  onClose,
}: {
  row: PatientPrescription;
  organizationName: string;
  onClose: () => void;
}) {
  const currency = row.quoteCurrency || "USD";
  const sheet = sheetFromPrescription(row, organizationName);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ordonnance {row.reference}</DialogTitle>
          <DialogDescription>
            Prescription du {new Date(row.validatedAt || row.createdAt || Date.now()).toLocaleDateString("fr-FR")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <section className="grid gap-2 sm:grid-cols-2">
            <p><span className="text-muted-foreground">Patient</span><br /><strong>{row.patientName}</strong></p>
            <p><span className="text-muted-foreground">Référence</span><br /><strong>{row.reference}</strong></p>
            <p><span className="text-muted-foreground">Médecin</span><br /><strong>{row.prescriberName}</strong></p>
            <p><span className="text-muted-foreground">Établissement</span><br /><strong>{row.organizationName || organizationName || "—"}</strong></p>
          </section>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => printOrdonnance(sheet)}
            >
              <Printer className="mr-2 h-4 w-4" /> Imprimer l'ordonnance
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadOrdonnance(sheet)}
            >
              <Download className="mr-2 h-4 w-4" /> PDF ordonnance
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openFinancialDocument(row, "print")}
            >
              <Receipt className="mr-2 h-4 w-4" /> Imprimer récap financier
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openFinancialDocument(row, "download")}
            >
              <Download className="mr-2 h-4 w-4" /> Télécharger récap
            </Button>
          </div>

          <section>
            <h3 className="mb-2 font-semibold">Médicaments prescrits</h3>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2">Médicament</th>
                    <th className="p-2">Dosage</th>
                    <th className="p-2">Forme</th>
                    <th className="p-2">Posologie</th>
                    <th className="p-2">Durée</th>
                    <th className="p-2 text-right">Qté</th>
                    <th className="p-2 text-right">P.U.</th>
                    <th className="p-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {row.items.map((item) => (
                    <tr key={item.id} className="border-t align-top">
                      <td className="p-2">
                        <div className="font-medium">{item.medication}</div>
                        {item.originalText ? (
                          <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{item.originalText}</pre>
                        ) : null}
                      </td>
                      <td className="p-2">{item.dosage || "—"}</td>
                      <td className="p-2">{item.formLabel || item.form || "—"}</td>
                      <td className="p-2">{item.posology || item.instructions || "—"}</td>
                      <td className="p-2">{item.duration || "—"}</td>
                      <td className="p-2 text-right">{item.quantityPrescribed}</td>
                      <td className="p-2 text-right">
                        {item.unitPrice == null ? "—" : formatMoney(item.unitPrice, currency)}
                      </td>
                      <td className="p-2 text-right">
                        {item.lineTotal == null ? "—" : formatMoney(item.lineTotal, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border p-4">
            <h3 className="mb-2 font-semibold">Montant à payer</h3>
            {!row.quoteIsFinal ? (
              <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Montants estimatifs — en attente de validation définitive par la pharmacie.
                Ce n'est pas encore le montant définitif à régler.
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-1 text-left">Médicament</th>
                    <th className="py-1 text-right">Quantité</th>
                    <th className="py-1 text-right">Prix unitaire</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {row.items.map((item) => (
                    <tr key={`fin-${item.id}`} className="border-t">
                      <td className="py-1.5">{item.medication}</td>
                      <td className="py-1.5 text-right">{item.quantityPrescribed}</td>
                      <td className="py-1.5 text-right">{item.unitPrice == null ? "—" : formatMoney(item.unitPrice, currency)}</td>
                      <td className="py-1.5 text-right">{item.lineTotal == null ? "—" : formatMoney(item.lineTotal, currency)}</td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold">
                    <td className="py-2" colSpan={3}>TOTAL</td>
                    <td className="py-2 text-right">{formatMoney(row.amountDue, currency)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid gap-1 sm:grid-cols-3">
              <p>Total : <strong>{formatMoney(row.amountDue, currency)}</strong></p>
              <p>Payé : <strong>{formatMoney(row.amountPaid, currency)}</strong></p>
              <p>Reste : <strong>{formatMoney(row.amountRemaining, currency)}</strong></p>
            </div>
            {row.invoice ? (
              <p className="mt-2 text-muted-foreground">
                Facture {row.invoice.invoiceNumber}
                {row.invoice.createdAt ? ` · ${new Date(row.invoice.createdAt).toLocaleDateString("fr-FR")}` : ""}
              </p>
            ) : null}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-semibold">État du paiement</h3>
              <Badge variant={paymentBadge(row)}>{row.paymentStatusLabel}</Badge>
              <ul className="mt-3 space-y-1 text-muted-foreground">
                <li>Total : {formatMoney(row.amountDue, currency)}</li>
                <li>Payé : {formatMoney(row.amountPaid, currency)}</li>
                <li>Solde : {formatMoney(row.amountRemaining, currency)}</li>
              </ul>
            </div>
            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-semibold">État de délivrance</h3>
              <Badge variant={dispenseBadge(row)}>{row.dispenseStatusLabel}</Badge>
              <ul className="mt-3 space-y-2">
                {row.items.map((item) => (
                  <li key={`disp-${item.id}`}>
                    <p className="font-medium">{item.medication}</p>
                    <p className="text-muted-foreground">
                      Prescrite : {item.quantityPrescribed} · Délivrée : {item.quantityDispensed}
                      {item.quantityRemaining > 0 ? ` · Restante : ${item.quantityRemaining}` : ""}
                      {" · "}{lineStatusLabel(item.lineDispenseStatus)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PatientOrdonnances() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<PatientPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PatientPrescriptionFilter>("all");
  const [selected, setSelected] = useState<PatientPrescription | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setRows(await prescriptionService.listMine({ filter }));
      } catch (error) {
        toast({ variant: "destructive", title: "Ordonnances indisponibles", description: apiMessage(error) });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [filter, toast]);

  const counts = useMemo(() => ({
    all: rows.length,
  }), [rows]);

  const openDetail = async (id: string) => {
    setOpeningId(id);
    try {
      setSelected(await prescriptionService.getMine(id));
    } catch (error) {
      toast({ variant: "destructive", title: "Détail indisponible", description: apiMessage(error) });
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Mes ordonnances</h1>
        <p className="mt-1 text-muted-foreground">
          Consultez vos prescriptions, les montants à régler et le suivi de délivrance.
        </p>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as PatientPrescriptionFilter)}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          {filters.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="text-xs sm:text-sm">
              {item.label}
              {item.value === "all" && !loading ? ` (${counts.all})` : ""}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-muted-foreground">Chargement des ordonnances…</p>
      ) : rows.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="py-12 text-center">
            <Pill className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Aucune ordonnance pour ce filtre.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id} className="card-elevated">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.reference}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(row.validatedAt || row.createdAt || Date.now()).toLocaleDateString("fr-FR")}
                      {" · "}{row.prescriberName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.itemCount} médicament{row.itemCount > 1 ? "s" : ""}
                      {" · "}
                      {row.quoteIsFinal ? formatMoney(row.amountDue, row.quoteCurrency) : (
                        <>Estimatif {formatMoney(row.amountDue, row.quoteCurrency)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={paymentBadge(row)}>{row.paymentStatusLabel}</Badge>
                    <Badge variant={dispenseBadge(row)}>
                      {row.dispenseStatusLabel || pharmacyStatusLabels[row.pharmacyStatus]}
                    </Badge>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={openingId === row.id}
                  onClick={() => void openDetail(row.id)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {openingId === row.id ? "Ouverture…" : "Voir le détail"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected ? (
        <DetailView
          row={selected}
          organizationName={user?.organization?.name || ""}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
