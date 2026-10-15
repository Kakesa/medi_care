import { useEffect, useRef, useState } from "react";
import { Plus, Search, FileText, Download, CreditCard, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { generateInvoicePDF } from "@/utils/pdfGenerator";
import { billingService } from "@/services/billingService";
import type { Invoice, InvoiceStatus, PaymentMethod } from "@/types";
import { apiMessage } from "@/lib/apiError";

export default function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [newInvoice, setNewInvoice] = useState({
    patientId: "",
    items: [{ description: "", quantity: 1, unitPrice: 0, type: "consultation" as "consultation" | "exam" | "medication" }],
    notes: "",
  });
  const pdfLock = useRef(new Set<string>());

  const loadBilling = async () => {
    try {
      const [invoiceResult, patientResult] = await Promise.all([
        billingService.getInvoices({ limit: 100 }),
        billingService.getBillingPatients(),
      ]);
      setInvoices(invoiceResult.data);
      setPatients(patientResult);
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
    total: invoices.reduce((sum, inv) => sum + inv.total, 0),
    paid: invoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + inv.total, 0),
    pending: invoices.filter(inv => inv.status === "pending").reduce((sum, inv) => sum + inv.total, 0),
  };

  const handleCreateInvoice = async () => {
    if (!newInvoice.patientId) {
      toast.error("Veuillez sélectionner un patient");
      return;
    }
    const items = newInvoice.items.filter((item) => item.description.trim());
    if (items.length === 0) {
      toast.error("Ajoutez au moins une ligne");
      return;
    }

    try {
      await billingService.createInvoice({
        patientId: newInvoice.patientId,
        patientName: "",
        items: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          type: item.type,
        })),
        tax: 0,
        discount: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        notes: newInvoice.notes || undefined,
      });
      setIsDialogOpen(false);
      setNewInvoice({ patientId: "", items: [{ description: "", quantity: 1, unitPrice: 0, type: "consultation" }], notes: "" });
      toast.success("Facture créée avec succès");
      await loadBilling();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const handleMarkAsPaid = async (invoice: Invoice, method: PaymentMethod) => {
    try {
      await billingService.markAsPaid(invoice.id, method);
      toast.success("Facture marquée comme payée");
      await loadBilling();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const handleDownloadPDF = (invoice: Invoice) => {
    if (pdfLock.current.has(invoice.id)) return;
    pdfLock.current.add(invoice.id);
    generateInvoicePDF(invoice);
    toast.success("PDF téléchargé");
    return new Promise<void>((resolve) => {
      window.setTimeout(() => {
        pdfLock.current.delete(invoice.id);
        resolve();
      }, 800);
    });
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    const config = {
      paid: { variant: "default" as const, label: "Payée" },
      pending: { variant: "secondary" as const, label: "En attente" },
      overdue: { variant: "destructive" as const, label: "En retard" },
      cancelled: { variant: "outline" as const, label: "Annulée" },
    };
    const { variant, label } = config[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Facturation</h1>
          <p className="text-muted-foreground">Gestion des factures et paiements</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nouvelle facture</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Créer une facture</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Patient</Label>
                <Select value={newInvoice.patientId} onValueChange={v => setNewInvoice({ ...newInvoice, patientId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un patient" /></SelectTrigger>
                  <SelectContent>
                    {patients.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newInvoice.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input placeholder="Description" value={item.description} onChange={e => {
                    const items = [...newInvoice.items];
                    items[idx].description = e.target.value;
                    setNewInvoice({ ...newInvoice, items });
                  }} />
                  <Input type="number" placeholder="Qté" value={item.quantity} onChange={e => {
                    const items = [...newInvoice.items];
                    items[idx].quantity = parseInt(e.target.value) || 1;
                    setNewInvoice({ ...newInvoice, items });
                  }} />
                  <Input type="number" placeholder="Prix" value={item.unitPrice} onChange={e => {
                    const items = [...newInvoice.items];
                    items[idx].unitPrice = parseFloat(e.target.value) || 0;
                    setNewInvoice({ ...newInvoice, items });
                  }} />
                  <Select value={item.type} onValueChange={v => {
                    const items = [...newInvoice.items];
                    items[idx].type = v as "consultation" | "exam";
                    setNewInvoice({ ...newInvoice, items });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="exam">Examen</SelectItem>
                      <SelectItem value="medication">Médicament</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setNewInvoice({
                ...newInvoice,
                items: [...newInvoice.items, { description: "", quantity: 1, unitPrice: 0, type: "consultation" as "consultation" | "exam" | "medication" }]
              })}>
                <Plus className="mr-2 h-4 w-4" />Ajouter ligne
              </Button>
              <Textarea placeholder="Notes" value={newInvoice.notes} onChange={e => setNewInvoice({ ...newInvoice, notes: e.target.value })} />
              <Button onClick={handleCreateInvoice} className="w-full">Créer la facture</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total facturé</p><p className="text-2xl font-bold">{stats.total.toFixed(2)} €</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Payé</p><p className="text-2xl font-bold text-success">{stats.paid.toFixed(2)} €</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">En attente</p><p className="text-2xl font-bold text-warning">{stats.pending.toFixed(2)} €</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="paid">Payées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoices list */}
      <div className="space-y-4">
        {filteredInvoices.map(invoice => (
          <Card key={invoice.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">{invoice.patientName}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="font-bold">{invoice.total.toFixed(2)} €</p>
                  <p className="text-xs text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
                {getStatusBadge(invoice.status)}
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleDownloadPDF(invoice)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {invoice.status === "pending" && (
                    <Button size="icon" onClick={() => handleMarkAsPaid(invoice, "card")}>
                      <CreditCard className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
