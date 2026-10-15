import { useEffect, useRef, useState } from "react";
import { Plus, Search, FileText, Download, CreditCard, Eye, Loader2, Receipt, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceCatalogPanel } from "@/components/billing/ServiceCatalogPanel";
import { billingService, type BillableServiceRecord } from "@/services/billingService";
import type { Invoice, InvoiceStatus, PaymentMethod } from "@/types";
import { apiMessage } from "@/lib/apiError";
import { categoryLabel, DEFAULT_CATEGORIES, type BillingCategory } from "@/lib/billingCategories";
import { formatMoney, type BillingCurrency } from "@/lib/money";
import { useAuth } from "@/contexts/AuthContext";

interface DraftLine {
  catalogItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  category: string;
  locked: boolean;
}

const emptyLine = (): DraftLine => ({
  catalogItemId: "manual",
  description: "",
  quantity: 1,
  unitPrice: 0,
  category: "CONSULTATION",
  locked: false,
});

const defaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
};

const money = (amount: number, currency: BillingCurrency | string = "EUR") => formatMoney(amount, currency);

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
  const { user } = useAuth();
  const canEditCatalog = user?.role === "HOSPITAL_ADMIN";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [services, setServices] = useState<BillableServiceRecord[]>([]);
  const [categories, setCategories] = useState<BillingCategory[]>(DEFAULT_CATEGORIES);
  const [currency, setCurrency] = useState<BillingCurrency>("EUR");
  const [currencies, setCurrencies] = useState<BillingCurrency[]>(["EUR", "CDF", "USD"]);
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
      const [invoiceResult, patientResult, settings, catalog] = await Promise.all([
        billingService.getInvoices({ limit: 100 }),
        billingService.getBillingPatients(),
        billingService.getSettings(),
        billingService.getServices(),
      ]);
      setInvoices(invoiceResult.data);
      setPatients(patientResult);
      setCurrency(settings.currency);
      setCurrencies(settings.currencies);
      setCategories(settings.categories);
      setServices(catalog);
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

  const inCurrency = (invoice: Invoice) => (invoice.currency || "EUR") === currency;
  const stats = {
    drafts: invoices.filter(inv => inv.status === "draft" && inCurrency(inv)).reduce((sum, inv) => sum + inv.total, 0),
    pending: invoices.filter(inv => (inv.status === "pending" || inv.status === "overdue") && inCurrency(inv)).reduce((sum, inv) => sum + inv.total, 0),
    paid: invoices.filter(inv => inv.status === "paid" && inCurrency(inv)).reduce((sum, inv) => sum + inv.total, 0),
  };
  const billableServices = services.filter((service) => service.active && service.currency === currency);

  const draftTotal = newInvoice.items.reduce((sum, item) => sum + item.quantity * (Number.isFinite(item.unitPrice) ? item.unitPrice : 0), 0);

  const resetForm = () => {
    setNewInvoice({ patientId: "", dueDate: defaultDueDate(), items: [emptyLine()], notes: "" });
  };

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    const items = newInvoice.items.map((item, current) => current === index ? { ...item, ...patch } : item);
    setNewInvoice({ ...newInvoice, items });
  };

  const removeLine = (index: number) => {
    if (newInvoice.items.length === 1) return;
    setNewInvoice({ ...newInvoice, items: newInvoice.items.filter((_, current) => current !== index) });
  };

  const chooseCatalog = (index: number, catalogItemId: string) => {
    if (catalogItemId === "manual") {
      updateLine(index, { catalogItemId, locked: false });
      return;
    }
    const service = billableServices.find((item) => item.id === catalogItemId);
    if (!service) return;
    updateLine(index, {
      catalogItemId,
      description: service.name,
      unitPrice: service.unitPrice,
      category: service.category,
      locked: true,
    });
  };

  const submitInvoice = async (finalize: boolean) => {
    if (savingRef.current) return;
    if (!newInvoice.patientId) {
      toast.error("Veuillez sélectionner un patient");
      return;
    }
    const items = newInvoice.items.filter((item) => item.catalogItemId !== "manual" || item.description.trim());
    if (items.length === 0) {
      toast.error("Ajoutez au moins une ligne");
      return;
    }
    if (items.some((item) => item.quantity < 1 || (item.catalogItemId === "manual" && item.unitPrice < 0))) {
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
          category: item.category,
          type: "service",
          ...(item.catalogItemId !== "manual" ? { catalogItemId: item.catalogItemId } : {}),
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
            <Button variant="hero"><Plus className="mr-2 h-4 w-4" />Nouvelle facture</Button>
          </DialogTrigger>
          <DialogContent
            className="flex max-w-lg flex-col gap-0 overflow-hidden p-0 sm:p-0"
            onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }}
            onPointerDownOutside={(event) => { if (saving) event.preventDefault(); }}
          >
            <DialogHeader className="shrink-0 border-b px-5 py-4">
              <div className="flex items-center gap-3 pr-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle>Nouvelle facture</DialogTitle>
                  <DialogDescription className="mt-1">Le brouillon reste modifiable. La finalisation fige le montant.</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <fieldset disabled={saving} className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Patient</Label>
                  <Select value={newInvoice.patientId} onValueChange={(patientId) => setNewInvoice({ ...newInvoice, patientId })} disabled={saving}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un patient" /></SelectTrigger>
                    <SelectContent>
                      {patients.map(patient => (
                        <SelectItem key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {patients.length === 0 && <p className="text-xs text-muted-foreground">Aucun patient enregistré.</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="dueDate">Date limite de paiement</Label>
                  <Input id="dueDate" type="date" value={newInvoice.dueDate} onChange={(event) => setNewInvoice({ ...newInvoice, dueDate: event.target.value })} />
                </div>
              </div>
              {newInvoice.items.map((item, index) => (
                <div key={index} className="space-y-3 rounded-xl border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Ligne {index + 1}</p>
                    {newInvoice.items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(index)} aria-label="Retirer la ligne">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Catalogue</Label>
                    <Select value={item.catalogItemId} onValueChange={(value) => chooseCatalog(index, value)} disabled={saving}>
                      <SelectTrigger><SelectValue placeholder="Choisir une prestation" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Saisie manuelle</SelectItem>
                        {billableServices.map((service) => (
                          <SelectItem key={service.id} value={service.id}>{service.code} — {service.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`line-description-${index}`}>Prestation</Label>
                    <Input id={`line-description-${index}`} placeholder="Consultation générale" value={item.description} disabled={item.locked} onChange={(event) => updateLine(index, { description: event.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`line-quantity-${index}`}>Quantité</Label>
                      <Input id={`line-quantity-${index}`} type="number" min={1} value={item.quantity} onChange={(event) => updateLine(index, { quantity: parseInt(event.target.value, 10) || 1 })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`line-price-${index}`}>Prix unitaire ({currency})</Label>
                      <Input id={`line-price-${index}`} type="number" min={0} step="0.01" value={item.unitPrice} disabled={item.locked} onChange={(event) => updateLine(index, { unitPrice: parseFloat(event.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Catégorie</Label>
                      <Select value={item.category} onValueChange={(category) => updateLine(index, { category })} disabled={saving || item.locked}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.code} value={category.code}>{category.label}</SelectItem>
                          ))}
                          {!categories.some((category) => category.code === item.category) && (
                            <SelectItem value={item.category}>{item.category}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 text-sm">
                    <span className="text-muted-foreground">Montant</span>
                    <span className="font-semibold">{money(item.quantity * item.unitPrice, currency)}</span>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full" onClick={() => setNewInvoice({ ...newInvoice, items: [...newInvoice.items, emptyLine()] })}>
                <Plus className="mr-2 h-4 w-4" />Ajouter une ligne
              </Button>
              <div className="space-y-2">
                <Label htmlFor="invoice-notes">Notes</Label>
                <Textarea id="invoice-notes" placeholder="Précision imprimée sur la facture" value={newInvoice.notes} onChange={(event) => setNewInvoice({ ...newInvoice, notes: event.target.value })} />
              </div>
            </fieldset>
            <div className="shrink-0 space-y-3 border-t bg-background px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold">{money(draftTotal, currency)}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" className="disabled:opacity-100" disabled={saving} onClick={() => submitInvoice(false)}>
                  {saving ? "Enregistrement..." : "Brouillon"}
                </Button>
                <Button type="button" variant="hero" className="disabled:opacity-100" disabled={saving} onClick={() => submitInvoice(true)}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                  {saving ? "Finalisation..." : "Finaliser"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Brouillons</p><p className="text-2xl font-bold">{money(stats.drafts, currency)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">À encaisser</p><p className="text-2xl font-bold text-warning">{money(stats.pending, currency)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Encaissé</p><p className="text-2xl font-bold text-success">{money(stats.paid, currency)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
          <TabsTrigger value="catalog">Catalogue</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="space-y-4">
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
                  <p className="font-bold">{money(invoice.total, invoice.currency || currency)}</p>
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
        </TabsContent>
        <TabsContent value="catalog">
          <ServiceCatalogPanel
            services={services}
            categories={categories}
            currency={currency}
            currencies={currencies}
            canEdit={canEditCatalog}
            onChanged={loadBilling}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={selectedInvoice !== null} onOpenChange={(open) => { if (!open && !actingRef.current) setSelectedInvoice(null); }}>
        <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:p-0">
          {selectedInvoice && (
            <>
              <DialogHeader className="shrink-0 border-b px-5 py-4">
                <div className="flex items-center gap-3 pr-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle>{selectedInvoice.invoiceNumber}</DialogTitle>
                    <DialogDescription className="mt-1">
                      {selectedInvoice.patientName} · échéance {new Date(selectedInvoice.dueDate).toLocaleDateString("fr-FR")}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {selectedInvoice.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-muted-foreground">
                        {item.quantity} × {money(item.unitPrice, selectedInvoice.currency || currency)}
                        {item.category ? ` · ${categoryLabel(categories, item.category)}` : ""}
                      </p>
                    </div>
                    <p className="font-medium">{money(item.total, selectedInvoice.currency || currency)}</p>
                  </div>
                ))}
                <div className="space-y-1 border-t pt-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-lg font-bold">{money(selectedInvoice.total, selectedInvoice.currency || currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Réglé</span>
                    <span>{money(selectedInvoice.paidAmount ?? (selectedInvoice.status === "paid" ? selectedInvoice.total : 0), selectedInvoice.currency || currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Solde</span>
                    <span className="font-medium">{money(selectedInvoice.balance ?? (selectedInvoice.status === "paid" || selectedInvoice.status === "cancelled" ? 0 : selectedInvoice.total), selectedInvoice.currency || currency)}</span>
                  </div>
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
                  <Button className="w-full" disabled={acting} onClick={() => finalizeSelected(selectedInvoice)}>
                    {acting ? "Finalisation..." : "Finaliser la facture"}
                  </Button>
                )}
                {payable && (
                  <div className="space-y-2">
                    <Label>Règlement</Label>
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
                      <Button variant="hero" className="disabled:opacity-100" disabled={acting} onClick={() => paySelected(selectedInvoice)}>
                        <CreditCard className="h-4 w-4" />
                        {acting ? "Encaissement..." : "Encaisser"}
                      </Button>
                    </div>
                  </div>
                )}
                {cancellable && (
                  <Button type="button" variant="outline" className="w-full" disabled={acting} onClick={() => cancelSelected(selectedInvoice)}>
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
