import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiMessage } from "@/lib/apiError";
import { formatMoney } from "@/lib/money";
import { patientService } from "@/services/patientService";
import { chargeService, type CatalogOption, type PatientChargeRecord, type RealizationStatus } from "@/services/chargeService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const realizationLabel: Record<RealizationStatus, string> = {
  recommended: "Recommandé",
  pending: "En attente",
  performed: "Réalisé",
  cancelled: "Annulé",
};

const paymentLabel: Record<string, string> = {
  draft: "Brouillon",
  pending: "À payer",
  overdue: "En retard",
  paid: "Payé",
  cancelled: "Paiement annulé",
  unbilled: "Non transmis",
};

const originLabel: Record<string, string> = {
  acts: "Actes",
  consultation: "Consultation",
  exam: "Examen",
  pharmacy: "Pharmacie",
  hospitalization: "Hospitalisation",
};

export function ActRecommendations() {
  const [patients, setPatients] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [patientId, setPatientId] = useState("");
  const [catalog, setCatalog] = useState<CatalogOption[]>([]);
  const [charges, setCharges] = useState<PatientChargeRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);

  const loadCharges = async (nextPatientId: string) => {
    if (!nextPatientId) {
      setCharges([]);
      return;
    }
    setCharges(await chargeService.list(nextPatientId));
  };

  useEffect(() => {
    void patientService.getAll({ limit: 100 }).then((result) => {
      setPatients(result.data.map((patient) => ({ id: patient.id, firstName: patient.firstName, lastName: patient.lastName })));
    }).catch((error) => toast.error(apiMessage(error)));
    void chargeService.catalog().then((result) => setCatalog(result.items)).catch((error) => toast.error(apiMessage(error)));
  }, []);

  useEffect(() => {
    void loadCharges(patientId).catch((error) => toast.error(apiMessage(error)));
  }, [patientId]);

  const selected = catalog.find((item) => `${item.kind}:${item.id}` === selectedId);
  const visible = catalog.filter((item) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return `${item.name} ${item.categoryLabel} ${item.description}`.toLowerCase().includes(needle);
  });

  const recommend = async () => {
    if (!patientId || !selected) {
      toast.error("Choisissez un patient et un acte tarifé");
      return;
    }
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 1) {
      toast.error("La quantité doit être un entier positif");
      return;
    }
    setSaving(true);
    try {
      await chargeService.recommend({
        patientId,
        catalogKind: selected.kind,
        catalogItemId: selected.id,
        quantity: parsed,
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Acte transmis à la facturation. Il reste au statut recommandé.");
      setOpen(false);
      setSelectedId("");
      setQuantity("1");
      setSearch("");
      await loadCharges(patientId);
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (charge: PatientChargeRecord, realizationStatus: RealizationStatus) => {
    try {
      await chargeService.update(charge.id, { realizationStatus });
      toast.success(realizationStatus === "cancelled" ? "Acte annulé" : "Statut mis à jour");
      await loadCharges(patientId);
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Label>Patient</Label>
            <Select value={patientId || undefined} onValueChange={setPatientId}>
              <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Choisir un patient" /></SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="hero" onClick={() => setOpen(true)} disabled={!patientId}>
            <Plus className="mr-2 h-4 w-4" />Recommander un acte
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Le tarif vient du catalogue. L'acte apparaît sur la facture du patient dès la recommandation, sans être considéré comme réalisé.
        </p>
        {!patientId && <p className="text-sm text-muted-foreground">Sélectionnez un patient pour voir ses actes transmis.</p>}
        {patientId && charges.length === 0 && <p className="text-sm text-muted-foreground">Aucun acte transmis pour ce patient.</p>}
        <div className="space-y-3">
          {charges.map((charge) => (
            <div key={charge.id} className="rounded-xl border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{charge.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {originLabel[charge.originModule] || charge.originModule} · {charge.prescriberName} · {new Date(charge.prescribedAt).toLocaleString("fr-FR")}
                  </p>
                  <p className="text-sm">{charge.quantity} × {formatMoney(charge.unitPrice, charge.currency)} · {formatMoney(charge.total, charge.currency)}</p>
                  {charge.invoiceNumber && <p className="text-xs text-muted-foreground">Facture {charge.invoiceNumber}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{realizationLabel[charge.realizationStatus]}</Badge>
                  <Badge variant="secondary">{paymentLabel[charge.paymentStatus] || charge.paymentStatus}</Badge>
                </div>
              </div>
              {charge.realizationStatus !== "cancelled" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {charge.realizationStatus === "recommended" && (
                    <Button size="sm" variant="outline" onClick={() => void setStatus(charge, "pending")}>En attente</Button>
                  )}
                  {charge.realizationStatus !== "performed" && (
                    <Button size="sm" variant="outline" onClick={() => void setStatus(charge, "performed")}>Marquer réalisé</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => void setStatus(charge, "cancelled")}>Annuler</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recommander un acte</DialogTitle>
            <DialogDescription>Seuls les actes déjà tarifés dans la devise de l'établissement sont proposés. Aucun prix n'est saisi ici.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Rechercher un acte" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {visible.length === 0 && <p className="text-sm text-muted-foreground">Aucun acte tarifé. Enregistrez d'abord un prix dans le catalogue.</p>}
              {visible.slice(0, 12).map((item) => {
                const key = `${item.kind}:${item.id}`;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`w-full rounded-lg border p-2 text-left text-sm ${selectedId === key ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => setSelectedId(key)}
                  >
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.categoryLabel} · {formatMoney(item.unitPrice, item.currency)}</p>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-qty">Quantité</Label>
              <Input id="charge-qty" type="number" min={1} max={99} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </div>
            <Button variant="hero" className="w-full" disabled={saving || !selected} onClick={() => void recommend()}>
              {saving ? "Transmission..." : "Transmettre à la facturation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
