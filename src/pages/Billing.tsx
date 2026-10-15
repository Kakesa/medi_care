import { useEffect, useRef, useState } from "react";
import { Plus, Search, FileText, Download, CreditCard, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { generateInvoicePDF } from "@/utils/pdfGenerator";
import { billingService } from "@/services/billingService";
import type { Invoice, InvoiceStatus, PaymentMethod } from "@/types";
import { apiMessage } from "@/lib/apiError";

type LineType = "consultation" | "exam" | "medication" | "service";

interface DraftLine {
  description: string;
  quantity: number;
  unitPrice: number;
  type: LineType;
}

const emptyLine = (): DraftLine => ({ description: "", quantity: 1, unitPrice: 0, type: "consultation" });

const defaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
};

const money = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Espèces",
  card: "Carte",
  transfer: "Virement",
  insurance: "Assurance",
};

const statusConfig: Record<InvoiceStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  draft: { variant: "outline", label: "Brouillon" },
  pending: { variant: "secondary", label: "Finalisée" },
  paid: { variant: "default", label: "Payée" },
  overdue: { variant: "destructive", label: "En retard" },
  cancelled: { variant: "outline", label: "Annulée" },
};

export default function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [newInvoice, setNewInvoice] = useState({
    patientId: "",
    dueDate: defaultDueDate(),
    items: [emptyLine()],
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const savingRef = useRef(false);
  const actingRef = useRef(false);
  const pdfLock = useRef(new Set<string>());

  const loadBilling = async () => {
    try {
      const [invoiceResult, patientResult] = await Promise.all([
        billingService.getInvoices({ limit: 100 }),
        billingService.getBillingPatients(),
      ]);
      setInvoices(invoiceResult.data);
      setPatients(patientResult);
      setSelectedInvoice((current) => current ? invoiceResult.data.find((invoice) => invoice.id === current.id) ?? current : current);
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  useEffect(() => {
    void loadBilling();
  }, []);

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    drafts: invoices.filter(inv => inv.status === "draft").reduce((sum, inv) => sum + inv.total, 0),
    pending: invoices.filter(inv => inv.status === "pending" || inv.status === "overdue").reduce((sum, inv) => sum + inv.total, 0),
    paid: invoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + inv.total, 0),
  };

  const draftTotal = newInvoice.items.reduce((sum, item) => sum + item.quantity * (Number.isFinite(item.unitPrice) ? item.unitPrice : 0), 0);

  const resetForm = () => {
    setNewInvoice({ patientId: "", dueDate: defaultDueDate(), items: [emptyLine()], notes: "" });
  };

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    const items = newInvoice.items.map((item, current) => current === index ? { ...item, ...patch } : item);
    setNewInvoice({ ...newInvoice, items });
  };

  const submitInvoice = async (finalize: boolean) => {
    if (savingRef.current) return;
    if (!newInvoice.patientId) {
      toast.error("Veuillez sélectionner un patient");
      return;
    }
    const items = newInvoice.items.filter((item) => item.description.trim());
    if (items.length === 0) {
      toast.error("Ajoutez au moins une ligne");
      return;
    }
    if (items.some((item) => item.quantity < 1 || item.unitPrice < 0)) {
      toast.error("Chaque ligne doit avoir une quantité et un prix valides");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const created = await billingService.createInvoice({
        patientId: newInvoice.patientId,
        patientName: "",
        items: items.map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          type: item.type,
        })),
        tax: 0,
        discount: 0,
        dueDate: newInvoice.dueDate,
        notes: newInvoice.notes || undefined,
      });
      const invoice = finalize ? await billingService.finalizeInvoice(created.id) : created;
      setIsDialogOpen(false);
      resetForm();
      toast.success(finalize ? `Facture ${invoice.invoiceNumber} finalisée` : "Brouillon enregistré");
      await loadBilling();
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const runAction = async (task: () => Promise<void>) => {
    if (actingRef.current) return;
    actingRef.current = true;
    setActing(true);
    try {
      await task();
    } finally {
      actingRef.current = false;
      setActing(false);
    }
  };

  const finalizeSelected = (invoice: Invoice) => runAction(async () => {
    try {
      const updated = await billingService.finalizeInvoice(invoice.id);
      setSelectedInvoice(updated);
      toast.success(`Facture ${updated.invoiceNumber} finalisée`);
      await loadBilling();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  });

  const paySelected = (invoice: Invoice) => runAction(async () => {
    try {
      const updated = await billingService.markAsPaid(invoice.id, paymentMethod);
      setSelectedInvoice(updated);
      toast.success("Facture encaissée");
      await loadBilling();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  });

  const cancelSelected = (invoice: Invoice) => runAction(async () => {
    try {
      const updated = await billingService.cancelInvoice(invoice.id);
      setSelectedInvoice(updated);
      toast.success("Facture annulée");
      await loadBilling();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  });

  const handleDownloadPDF = (invoice: Invoice) => {
    if (pdfLock.current.has(invoice.id)) return;
    pdfLock.current.add(invoice.id);
    generateInvoicePDF(invoice);
    toast.success(invoice.status === "draft" ? "Brouillon téléchargé" : "PDF téléchargé");
    return new Promise<void>((resolve) => {
      window.setTimeout(() => {
        pdfLock.current.delete(invoice.id);
        resolve();
      }, 800);
    });
  };

  const payable = selectedInvoice?.status === "pending" || selectedInvoice?.status === "overdue";
  const cancellable = selectedInvoice?.status === "draft" || payable;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Facturation</h1>
          <p className="text-muted-foreground">Un brouillon reste modifiable. La finalisation le verrouille avant l'encaissement.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!savingRef.current) setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nouvelle facture</Button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:p-0">
            <DialogHeader className="shrink-0 border-b px-5 py-4">
              <DialogTitle>Nouvelle facture</DialogTitle>
              <DialogDescription>Vérifiez le patient, les lignes et le total, puis finalisez.</DialogDescription>
            </DialogHeader>
            <fieldset disabled={saving} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-2">
                <Label>Patient</Label>
                <Select value={newInvoice.patientId} onValueChange={(patientId) => setNewInvoice({ ...newInvoice, patientId })} disabled={saving}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un patient" /></SelectTrigger>
                  <SelectContent>
                    {patients.map(patient => (
                      <SelectItem key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Échéance</Label>
                <Input id="dueDate" type="date" value={newInvoice.dueDate} onChange={(event) => setNewInvoice({ ...newInvoice, dueDate: event.target.value })} />
              </div>
              <div className="space-y-3">
                {newInvoice.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2">
                    <Input className="sm:col-span-2" placeholder="Description" value={item.description} onChange={(event) => updateLine(index, { description: event.target.value })} />
                    <Input type="number" min={1} placeholder="Quantité" value={item.quantity} onChange={(event) => updateLine(index, { quantity: parseInt(event.target.value, 10) || 1 })} />
                    <Input type="number" min={0} step="0.01" placeholder="Prix unitaire" value={item.unitPrice} onChange={(event) => updateLine(index, { unitPrice: parseFloat(event.target.value) || 0 })} />
                    <Select value={item.type} onValueChange={(value) => updateLine(index, { type: value as LineType })} disabled={saving}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consultation">Consultation</SelectItem>
                        <SelectItem value="exam">Examen</SelectItem>
                        <SelectItem value="medication">Médicament</SelectItem>
                        <SelectItem value="service">Autre prestation</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="self-center text-right text-sm font-medium">{money(item.quantity * item.unitPrice)}</p>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setNewInvoice({ ...newInvoice, items: [...newInvoice.items, emptyLine()] })}>
                <Plus className="mr-2 h-4 w-4" />Ajouter une ligne
              </Button>
              <Textarea placeholder="Notes" value={newInvoice.notes} onChange={(event) => setNewInvoice({ ...newInvoice, notes: event.target.value })} />
              <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                <span className="text-sm text-muted-foreground">Total à finaliser</span>
                <span className="text-lg font-bold">{money(draftTotal)}</span>
              </div>
            </fieldset>
            <div className="grid shrink-0 gap-2 border-t px-5 py-4 sm:grid-cols-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => void submitInvoice(false)}>
                {saving ? "Enregistrement..." : "Enregistrer le brouillon"}
              </Button>
              <Button type="button" disabled={saving} onClick={() => void submitInvoice(true)}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {saving ? "Finalisation..." : "Finaliser la facture"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Brouillons</p><p className="text-2xl font-bold">{money(stats.drafts)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">À encaisser</p><p className="text-2xl font-bold text-warning">{money(stats.pending)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Encaissé</p><p className="text-2xl font-bold text-success">{money(stats.paid)}</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher un patient ou un numéro" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="draft">Brouillons</SelectItem>
            <SelectItem value="pending">Finalisées</SelectItem>
            <SelectItem value="overdue">En retard</SelectItem>
            <SelectItem value="paid">Payées</SelectItem>
            <SelectItem value="cancelled">Annulées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredInvoices.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune facture pour ce filtre.</p>
        )}
        {filteredInvoices.map(invoice => (
          <Card key={invoice.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="truncate text-sm text-muted-foreground">{invoice.patientName}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="font-bold">{money(invoice.total)}</p>
                  <p className="text-xs text-muted-foreground">Échéance {new Date(invoice.dueDate).toLocaleDateString("fr-FR")}</p>
                </div>
                <Badge variant={statusConfig[invoice.status].variant}>{statusConfig[invoice.status].label}</Badge>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => { setPaymentMethod("card"); setSelectedInvoice(invoice); }} aria-label="Voir la facture">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDownloadPDF(invoice)} aria-label="Télécharger le PDF">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={selectedInvoice !== null} onOpenChange={(open) => { if (!open && !actingRef.current) setSelectedInvoice(null); }}>
        <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:p-0">
          {selectedInvoice && (
            <>
              <DialogHeader className="shrink-0 border-b px-5 py-4">
                <DialogTitle>{selectedInvoice.invoiceNumber}</DialogTitle>
                <DialogDescription>
                  {selectedInvoice.patientName} · échéance {new Date(selectedInvoice.dueDate).toLocaleDateString("fr-FR")}
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {selectedInvoice.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-muted-foreground">{item.quantity} × {money(item.unitPrice)}</p>
                    </div>
                    <p className="font-medium">{money(item.total)}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-lg font-bold">{money(selectedInvoice.total)}</span>
                </div>
                {selectedInvoice.notes && <p className="text-sm text-muted-foreground">{selectedInvoice.notes}</p>}
                {selectedInvoice.status === "paid" && (
                  <p className="text-sm">Encaissée {selectedInvoice.paymentMethod ? `par ${paymentLabels[selectedInvoice.paymentMethod].toLowerCase()}` : ""}.</p>
                )}
                {selectedInvoice.status === "draft" && (
                  <p className="text-sm text-muted-foreground">La finalisation fige les lignes et autorise l'encaissement.</p>
                )}
              </div>
              <div className="shrink-0 space-y-2 border-t px-5 py-4">
                {selectedInvoice.status === "draft" && (
                  <Button className="w-full" disabled={acting} onClick={() => void finalizeSelected(selectedInvoice)}>
                    {acting ? "Finalisation..." : "Finaliser la facture"}
                  </Button>
                )}
                {payable && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)} disabled={acting}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Espèces</SelectItem>
                        <SelectItem value="card">Carte</SelectItem>
                        <SelectItem value="transfer">Virement</SelectItem>
                        <SelectItem value="insurance">Assurance</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button disabled={acting} onClick={() => void paySelected(selectedInvoice)}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      {acting ? "Encaissement..." : "Encaisser"}
                    </Button>
                  </div>
                )}
                {cancellable && (
                  <Button type="button" variant="outline" className="w-full" disabled={acting} onClick={() => void cancelSelected(selectedInvoice)}>
                    Annuler la facture
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
