import { useEffect, useState } from "react";
import { Download, Edit, FileText, Plus, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pharmacyCategories } from "@/data/mockData";
import { pharmacyService, type PharmacyStockSheet } from "@/services/pharmacyService";
import type { PharmacyProduct } from "@/types";
import { apiMessage } from "@/lib/apiError";
import { formatMoney } from "@/lib/money";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  genericName: "",
  sku: "",
  barcode: "",
  category: "",
  dosage: "",
  form: "",
  packaging: "",
  quantity: 0,
  minStock: 0,
  maxStock: 0,
  alertStock: 0,
  unit: "",
  storageUnit: "",
  saleUnit: "",
  unitFactor: 1,
  price: 0,
  purchasePrice: 0,
  location: "",
  description: "",
  supplier: "",
  expiryDate: "",
};

function statusLabel(status: string) {
  if (status === "in_stock") return "En stock";
  if (status === "low_stock") return "Sous le seuil";
  if (status === "out_of_stock") return "Rupture";
  return status;
}

function escapeHtml(value: string) {
  return value.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;");
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Kinshasa", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(date);
}

function printSheet(sheet: PharmacyStockSheet, currency: string) {
  const product = sheet.product;
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!popup) {
    toast.error("Autorisez les fenêtres pour imprimer la fiche");
    return;
  }
  const rows = sheet.lines.map((line) => `<tr>
    <td>${escapeHtml(formatDate(line.date))}</td>
    <td>${escapeHtml(line.reference)}</td>
    <td>${escapeHtml(line.lotNumber)}</td>
    <td>${escapeHtml(line.origin || line.destination)}</td>
    <td>${line.quantityIn || ""}</td>
    <td>${line.quantityIn ? escapeHtml(formatMoney(line.unitCost, currency)) : ""}</td>
    <td>${escapeHtml(formatDate(line.expiresAt))}</td>
    <td>${line.quantityOut || ""}</td>
    <td>${line.remaining}</td>
  </tr>`).join("");
  popup.document.write(`<!DOCTYPE html><html lang="fr"><head><title>Fiche de stock</title>
    <style>
      body { font-family: Arial, sans-serif; color: #142; margin: 24px; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
      th { background: #f4fafa; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-top: 12px; font-size: 13px; }
    </style></head><body>
    <h1>Fiche de stock — ${escapeHtml(product.name)}</h1>
    <div class="meta">
      <div>DCI : ${escapeHtml(product.genericName || "")}</div>
      <div>Code : ${escapeHtml(product.sku || "")}</div>
      <div>Dosage : ${escapeHtml(product.dosage || "")}</div>
      <div>Conditionnement : ${escapeHtml(product.packaging || "")}</div>
      <div>Stock minimum : ${product.minStock}</div>
      <div>Stock maximum : ${product.maxStock || "—"}</div>
      <div>Seuil d'alerte : ${product.alertStock || product.minStock}</div>
      <div>Emplacement : ${escapeHtml(product.location || "")}</div>
    </div>
    <table><thead><tr>
      <th>Date</th><th>Référence</th><th>Lot</th><th>Provenance / destination</th>
      <th>Entrée</th><th>Prix de revient</th><th>Péremption</th><th>Sortie</th><th>Reste</th>
    </tr></thead><tbody>${rows || "<tr><td colspan='9'>Aucun mouvement</td></tr>"}</tbody></table>
    </body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') { cell += '"'; index += 1; }
        else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter((line) => line.some((value) => value.trim()));
  if (!header) return [];
  return body.map((columns) => Object.fromEntries(header.map((key, index) => [key.trim(), columns[index]?.trim() || ""])));
}

interface PharmacyCatalogProps {
  currency: string;
  canManage: boolean;
  orderLabel: string;
  onOrder: (product: PharmacyProduct) => void;
  onChanged: () => void;
}

export function PharmacyCatalog({ currency, canManage, orderLabel, onOrder, onChanged }: PharmacyCatalogProps) {
  const [rows, setRows] = useState<PharmacyProduct[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PharmacyProduct | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [sheet, setSheet] = useState<PharmacyStockSheet | null>(null);

  const load = async () => {
    try {
      const result = await pharmacyService.getProducts({
        page,
        limit: 8,
        search: search || undefined,
        category: category === "all" ? undefined : category,
        status: status === "all" ? undefined : status,
      });
      setRows(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  useEffect(() => {
    void load();
  }, [page, search, category, status]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (product: PharmacyProduct) => {
    setEditing(product);
    setForm({
      name: product.name,
      genericName: product.genericName || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      category: product.category,
      dosage: product.dosage || "",
      form: product.form || "",
      packaging: product.packaging || "",
      quantity: product.quantity,
      minStock: product.minStock,
      maxStock: product.maxStock || 0,
      alertStock: product.alertStock || 0,
      unit: product.unit,
      storageUnit: product.storageUnit || "",
      saleUnit: product.saleUnit || "",
      unitFactor: product.unitFactor || 1,
      price: product.price,
      purchasePrice: product.purchasePrice || 0,
      location: product.location || "",
      description: product.description || "",
      supplier: product.supplier,
      expiryDate: product.expiryDate || "",
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.category || !form.unit) {
      toast.error("Nom, catégorie et unité sont requis");
      return;
    }
    const payload = {
      ...form,
      quantity: editing ? editing.quantity : form.quantity,
      expiryDate: form.expiryDate || undefined,
      supplier: form.supplier,
    };
    try {
      if (editing) {
        await pharmacyService.updateProduct(editing.id, payload);
        toast.success("Produit modifié");
      } else {
        await pharmacyService.createProduct(payload);
        toast.success("Produit ajouté");
      }
      setFormOpen(false);
      await load();
      onChanged();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const archive = async (id: string) => {
    try {
      await pharmacyService.deleteProduct(id);
      toast.success("Produit archivé");
      await load();
      onChanged();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const openSheet = async (id: string) => {
    try {
      setSheet(await pharmacyService.getStockSheet(id));
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const download = async () => {
    try {
      const file = await pharmacyService.exportProducts({
        search: search || undefined,
        category: category === "all" ? undefined : category,
        status: status === "all" ? undefined : status,
      });
      const blob = new Blob([file.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const importFile = async (file: File) => {
    const parsed = parseCsv(await file.text());
    const rows = parsed.map((line) => ({
      name: line.nom || line.name || "",
      genericName: line.generique || "",
      sku: line.code || "",
      barcode: line.codeBarres || "",
      category: line.categorie || "",
      dosage: line.dosage || "",
      form: line.forme || "",
      packaging: line.conditionnement || "",
      unit: line.unite || "",
      storageUnit: line.uniteAchat || "",
      saleUnit: line.uniteDelivrance || "",
      unitFactor: Number(String(line.conversion || "1").replace(",", ".")) || 1,
      purchasePrice: Number(String(line.prixAchat || "0").replace(",", ".")) || 0,
      price: Number(String(line.prixVente || "0").replace(",", ".")) || 0,
      quantity: Number(line.quantite || 0) || 0,
      minStock: Number(line.stockMin || 0) || 0,
      maxStock: Number(line.stockMax || 0) || 0,
      alertStock: Number(line.seuilAlerte || 0) || 0,
      location: line.emplacement || "",
      description: line.description || "",
      supplier: line.fournisseur || "",
    })).filter((line) => line.name);
    if (!rows.length) {
      toast.error("Le fichier ne contient aucun produit");
      return;
    }
    try {
      const result = await pharmacyService.importProducts(rows);
      toast.success(`${result.created} produit(s) importé(s)`);
      if (result.errors.length) toast.error(result.errors.map((error) => `Ligne ${error.row} : ${error.message}`).join(" · "));
      await load();
      onChanged();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const set = (patch: Partial<typeof emptyForm>) => setForm((current) => ({ ...current, ...patch }));
  const categories = pharmacyCategories.includes(form.category) || !form.category
    ? pharmacyCategories
    : [form.category, ...pharmacyCategories];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form className="relative flex-1" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchDraft.trim()); }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Nom, DCI, code ou code-barres" className="pl-10" />
        </form>
        <Select value={category} onValueChange={(value) => { setCategory(value); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {pharmacyCategories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="in_stock">En stock</SelectItem>
            <SelectItem value="low_stock">Sous le seuil</SelectItem>
            <SelectItem value="out_of_stock">Rupture</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => void download()}><Download className="mr-1 h-4 w-4" />Exporter</Button>
        {canManage && (
          <label className="inline-flex">
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importFile(file);
            }} />
            <span className="inline-flex h-10 cursor-pointer items-center rounded-md border px-3 text-sm"><Upload className="mr-1 h-4 w-4" />Importer</span>
          </label>
        )}
        {canManage && <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Ajouter</Button>}
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Seuil</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-muted-foreground">Aucun produit pour ces filtres.</TableCell></TableRow>
            )}
            {rows.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.genericName || product.category}{product.dosage ? ` · ${product.dosage}` : ""}</p>
                </TableCell>
                <TableCell>{product.sku || "—"}</TableCell>
                <TableCell>{product.quantity} {product.unit}</TableCell>
                <TableCell>{product.alertStock || product.minStock}</TableCell>
                <TableCell>{formatMoney(product.price, product.currency || currency)}</TableCell>
                <TableCell><Badge variant={product.status === "out_of_stock" ? "destructive" : product.status === "low_stock" ? "secondary" : "default"}>{statusLabel(product.status)}</Badge></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => void openSheet(product.id)}><FileText className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => onOrder(product)}>{orderLabel}</Button>
                    {canManage && <Button variant="ghost" size="sm" onClick={() => openEdit(product)}><Edit className="h-4 w-4" /></Button>}
                    {canManage && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Archiver {product.name} ?</AlertDialogTitle>
                            <AlertDialogDescription>Le produit disparaît du catalogue. L’historique des mouvements reste conservé.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void archive(product.id)}>Archiver</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} produit(s)</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Précédent</Button>
          <span className="self-center">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Suivant</Button>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le produit" : "Ajouter un produit"}</DialogTitle>
            <DialogDescription>Le stock change uniquement par un mouvement. La quantité d’ouverture crée le premier lot.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label>Nom commercial</Label><Input value={form.name} onChange={(event) => set({ name: event.target.value })} /></div>
            <div className="space-y-1"><Label>Dénomination générique</Label><Input value={form.genericName} onChange={(event) => set({ genericName: event.target.value })} /></div>
            <div className="space-y-1"><Label>Code</Label><Input value={form.sku} onChange={(event) => set({ sku: event.target.value })} /></div>
            <div className="space-y-1"><Label>Code-barres</Label><Input value={form.barcode} onChange={(event) => set({ barcode: event.target.value })} /></div>
            <div className="space-y-1">
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={(value) => set({ category: value })}>
                <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Dosage</Label><Input value={form.dosage} onChange={(event) => set({ dosage: event.target.value })} /></div>
            <div className="space-y-1"><Label>Forme</Label><Input value={form.form} onChange={(event) => set({ form: event.target.value })} placeholder="Comprimé, sirop…" /></div>
            <div className="space-y-1"><Label>Conditionnement</Label><Input value={form.packaging} onChange={(event) => set({ packaging: event.target.value })} /></div>
            <div className="space-y-1"><Label>Unité</Label><Input value={form.unit} onChange={(event) => set({ unit: event.target.value })} /></div>
            <div className="space-y-1"><Label>Unité d’achat</Label><Input value={form.storageUnit} onChange={(event) => set({ storageUnit: event.target.value })} /></div>
            <div className="space-y-1"><Label>Unité de délivrance</Label><Input value={form.saleUnit} onChange={(event) => set({ saleUnit: event.target.value })} /></div>
            <div className="space-y-1"><Label>Conversion (1 achat = N délivrances)</Label><Input type="number" min="0" step="0.01" value={form.unitFactor} onChange={(event) => set({ unitFactor: Number(event.target.value) || 1 })} /></div>
            <div className="space-y-1"><Label>Prix d’achat ({currency})</Label><Input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(event) => set({ purchasePrice: Number(event.target.value) || 0 })} /></div>
            <div className="space-y-1"><Label>Prix de vente ({currency})</Label><Input type="number" min="0" step="0.01" value={form.price} onChange={(event) => set({ price: Number(event.target.value) || 0 })} /></div>
            <div className="space-y-1"><Label>{editing ? "Stock actuel" : "Quantité d’ouverture"}</Label><Input type="number" min="0" disabled={Boolean(editing)} value={form.quantity} onChange={(event) => set({ quantity: Number(event.target.value) || 0 })} /></div>
            <div className="space-y-1"><Label>Stock minimum</Label><Input type="number" min="0" value={form.minStock} onChange={(event) => set({ minStock: Number(event.target.value) || 0 })} /></div>
            <div className="space-y-1"><Label>Stock maximum</Label><Input type="number" min="0" value={form.maxStock} onChange={(event) => set({ maxStock: Number(event.target.value) || 0 })} /></div>
            <div className="space-y-1"><Label>Seuil d’alerte</Label><Input type="number" min="0" value={form.alertStock} onChange={(event) => set({ alertStock: Number(event.target.value) || 0 })} /></div>
            <div className="space-y-1"><Label>Emplacement</Label><Input value={form.location} onChange={(event) => set({ location: event.target.value })} /></div>
            <div className="space-y-1"><Label>Fournisseur</Label><Input value={form.supplier} onChange={(event) => set({ supplier: event.target.value })} /></div>
            <div className="space-y-1"><Label>Péremption du lot d’ouverture</Label><Input type="date" value={form.expiryDate} onChange={(event) => set({ expiryDate: event.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(event) => set({ description: event.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button onClick={() => void save()}>{editing ? "Enregistrer" : "Ajouter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(sheet)} onOpenChange={(open) => { if (!open) setSheet(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Fiche de stock — {sheet?.product.name}</DialogTitle>
            <DialogDescription>
              {sheet?.product.dosage || "Sans dosage"} · min {sheet?.product.minStock} · max {sheet?.product.maxStock || "—"} · alerte {sheet?.product.alertStock || sheet?.product.minStock}
            </DialogDescription>
          </DialogHeader>
          {sheet && (
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Origine / destination</TableHead>
                    <TableHead>Entrée</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Péremption</TableHead>
                    <TableHead>Sortie</TableHead>
                    <TableHead>Reste</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheet.lines.length === 0 && <TableRow><TableCell colSpan={9}>Aucun mouvement.</TableCell></TableRow>}
                  {sheet.lines.map((line, index) => (
                    <TableRow key={`${line.reference}-${index}`}>
                      <TableCell>{formatDate(line.date)}</TableCell>
                      <TableCell className="max-w-[8rem] truncate">{line.reference}</TableCell>
                      <TableCell>{line.lotNumber || "—"}</TableCell>
                      <TableCell>{line.origin || line.destination || "—"}</TableCell>
                      <TableCell>{line.quantityIn || ""}</TableCell>
                      <TableCell>{line.quantityIn ? formatMoney(line.unitCost, currency) : ""}</TableCell>
                      <TableCell>{formatDate(line.expiresAt)}</TableCell>
                      <TableCell>{line.quantityOut || ""}</TableCell>
                      <TableCell>{line.remaining}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSheet(null)}>Fermer</Button>
            {sheet && <Button onClick={() => printSheet(sheet, currency)}>Imprimer</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
