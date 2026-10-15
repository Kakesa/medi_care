import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UNIT_LABELS, categoryLabel, type BillingCategory } from "@/lib/billingCategories";
import { formatMoney, type BillingCurrency } from "@/lib/money";
import { apiMessage } from "@/lib/apiError";
import { billingService, type BillableServiceRecord } from "@/services/billingService";

const UNITS = Object.keys(UNIT_LABELS);

interface ServiceCatalogPanelProps {
  services: BillableServiceRecord[];
  categories: BillingCategory[];
  currency: BillingCurrency;
  currencies: BillingCurrency[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
}

const emptyForm = (category: string) => ({
  code: "",
  name: "",
  category,
  unitPrice: "",
  unit: "acte",
  department: "",
});

export function ServiceCatalogPanel({
  services,
  categories,
  currency,
  currencies,
  canEdit,
  onChanged,
}: ServiceCatalogPanelProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BillableServiceRecord | null>(null);
  const [form, setForm] = useState(emptyForm(categories[0]?.code || "AUTRE"));
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(categories[0]?.code || "AUTRE"));
    setOpen(true);
  };

  const openEdit = (service: BillableServiceRecord) => {
    setEditing(service);
    setForm({
      code: service.code,
      name: service.name,
      category: service.category,
      unitPrice: String(service.unitPrice),
      unit: service.unit,
      department: service.department || "",
    });
    setOpen(true);
  };

  const save = async () => {
    const unitPrice = Number(form.unitPrice);
    if (!form.name.trim() || !Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error("Indiquez un nom et un prix unitaire");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await billingService.updateService(editing.id, {
          name: form.name.trim(),
          category: form.category,
          unitPrice,
          unit: form.unit,
          department: form.department.trim(),
        });
        toast.success("Tarif mis à jour");
      } else {
        if (!form.code.trim()) {
          toast.error("Indiquez un code de prestation");
          return;
        }
        await billingService.createService({
          code: form.code.trim(),
          name: form.name.trim(),
          category: form.category,
          unitPrice,
          unit: form.unit,
          department: form.department.trim() || undefined,
        });
        toast.success("Prestation ajoutée au catalogue");
      }
      setOpen(false);
      await onChanged();
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const changeCurrency = async (next: BillingCurrency) => {
    try {
      await billingService.updateSettings(next);
      toast.success("Devise de l'établissement mise à jour");
      await onChanged();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const toggleActive = async (service: BillableServiceRecord) => {
    try {
      await billingService.updateService(service.id, { active: !service.active });
      await onChanged();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Label>Devise de l'établissement</Label>
          {canEdit ? (
            <Select value={currency} onValueChange={(value) => changeCurrency(value as BillingCurrency)}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.map((code) => (
                  <SelectItem key={code} value={code}>{code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium">{currency}</p>
          )}
          <p className="text-xs text-muted-foreground">Les factures déjà créées conservent leur devise. Un tarif existant change de devise seulement lorsque son prix est modifié.</p>
        </div>
        {canEdit && (
          <Button variant="hero" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nouvelle prestation</Button>
        )}
      </div>

      {services.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aucune prestation dans le catalogue. Les lignes manuelles restent possibles sur une facture.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {services.map((service) => (
            <Card key={service.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{service.name}</p>
                    <Badge variant="outline">{service.code}</Badge>
                    {!service.active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {categoryLabel(categories, service.category)} · {UNIT_LABELS[service.unit] || service.unit}
                    {service.department ? ` · ${service.department}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-semibold">{formatMoney(service.unitPrice, service.currency)}</p>
                  {canEdit && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEdit(service)}>Modifier</Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(service)}>{service.active ? "Désactiver" : "Activer"}</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le tarif" : "Nouvelle prestation"}</DialogTitle>
            <DialogDescription>
              {editing ? `Le nouveau prix sera enregistré en ${currency}.` : `Le tarif est enregistré en ${currency}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!editing && (
              <div className="space-y-2">
                <Label htmlFor="service-code">Code</Label>
                <Input id="service-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="CONS-GEN" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="service-name">Nom</Label>
              <Input id="service-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Consultation générale" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={(category) => setForm({ ...form, category })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.code} value={category.code}>{category.label}</SelectItem>
                    ))}
                    {!categories.some((category) => category.code === form.category) && (
                      <SelectItem value={form.category}>{form.category}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unité</Label>
                <Select value={form.unit} onValueChange={(unit) => setForm({ ...form, unit })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>{UNIT_LABELS[unit]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="service-price">Prix unitaire ({currency})</Label>
                <Input id="service-price" type="number" min={0} step="0.01" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-department">Service</Label>
                <Input id="service-department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="Médecine" />
              </div>
            </div>
            <Button className="w-full" variant="hero" disabled={saving} onClick={() => save()}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
