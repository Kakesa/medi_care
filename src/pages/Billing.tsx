import { useState } from "react";
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
import { mockPatients, mockConsultations, mockExams } from "@/data/mockData";
import { generateInvoicePDF } from "@/utils/pdfGenerator";
import type { Invoice, InvoiceItem, InvoiceStatus, PaymentMethod } from "@/types";

// Mock invoices
const initialInvoices: Invoice[] = [
  {
    id: "inv-1",
    invoiceNumber: "FAC-2024-001",
    patientId: "pat-1",
    patientName: "Jean Martin",
    patientAddress: "12 Rue de Paris, 75001 Paris",
    patientPhone: "06 12 34 56 78",
    items: [
      { id: "item-1", description: "Consultation cardiologie", quantity: 1, unitPrice: 50, total: 50, type: "consultation" },
      { id: "item-2", description: "ECG", quantity: 1, unitPrice: 30, total: 30, type: "exam" },
    ],
    subtotal: 80,
    tax: 0,
    discount: 0,
    total: 80,
    status: "paid",
    paymentMethod: "card",
    paidAt: "2024-01-20",
    dueDate: "2024-02-01",
    createdAt: "2024-01-15",
    updatedAt: "2024-01-20",
  },
  {
    id: "inv-2",
    invoiceNumber: "FAC-2024-002",
    patientId: "pat-2",
    patientName: "Marie Dupont",
    patientAddress: "8 Avenue Victor Hugo, 75016 Paris",
    items: [
      { id: "item-3", description: "Consultation générale", quantity: 1, unitPrice: 25, total: 25, type: "consultation" },
    ],
    subtotal: 25,
    tax: 0,
    discount: 0,
    total: 25,
    status: "pending",
    dueDate: "2024-02-15",
    createdAt: "2024-01-22",
    updatedAt: "2024-01-22",
  },
];

export default function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [newInvoice, setNewInvoice] = useState({
    patientId: "",
    items: [{ description: "", quantity: 1, unitPrice: 0, type: "consultation" as "consultation" | "exam" | "medication" }],
    notes: "",
  });

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

  const handleCreateInvoice = () => {
    const patient = mockPatients.find(p => p.id === newInvoice.patientId);
    if (!patient) {
      toast.error("Veuillez sélectionner un patient");
      return;
    }

    const items: InvoiceItem[] = newInvoice.items.map((item, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
      type: item.type,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `FAC-2024-${String(invoices.length + 1).padStart(3, "0")}`,
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientAddress: patient.address,
      patientPhone: patient.phone,
      items,
      subtotal,
      tax: 0,
      discount: 0,
      total: subtotal,
      status: "pending",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      notes: newInvoice.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setInvoices([invoice, ...invoices]);
    setIsDialogOpen(false);
    setNewInvoice({ patientId: "", items: [{ description: "", quantity: 1, unitPrice: 0, type: "consultation" }], notes: "" });
    toast.success("Facture créée avec succès");
  };

  const handleMarkAsPaid = (invoice: Invoice, method: PaymentMethod) => {
    setInvoices(invoices.map(inv =>
      inv.id === invoice.id
        ? { ...inv, status: "paid" as InvoiceStatus, paymentMethod: method, paidAt: new Date().toISOString() }
        : inv
    ));
    toast.success("Facture marquée comme payée");
  };

  const handleDownloadPDF = (invoice: Invoice) => {
    generateInvoicePDF(invoice);
    toast.success("PDF téléchargé");
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
      <div className="flex items-center justify-between">
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
                    {mockPatients.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newInvoice.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2">
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
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">{invoice.patientName}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
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
