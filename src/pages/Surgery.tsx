import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { apiMessage } from "@/lib/apiError";
import { formatMoney, type BillingCurrency } from "@/lib/money";
import { ActRecommendations } from "@/components/acts/ActRecommendations";
import { billingService } from "@/services/billingService";
import {
  surgeryService,
  type SurgeryStats,
  type SurgicalAct,
  type SurgicalCategory,
  type SurgicalChange,
  type SurgicalPriceChange,
} from "@/services/surgeryService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const actionLabels: Record<string, string> = {
  SURGICAL_ACT_CREATED: "Acte créé",
  SURGICAL_ACT_UPDATED: "Acte modifié",
  SURGICAL_CATEGORY_CREATED: "Catégorie créée",
};

function localDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function periodRange(preset: string, customStart: string, customEnd: string) {
  const today = new Date();
  const endDate = localDay(today);
  if (preset === "custom") return { startDate: customStart, endDate: customEnd || endDate };
  if (preset === "today") return { startDate: endDate, endDate };
  const start = new Date(today);
  if (preset === "week") start.setDate(today.getDate() - 6);
  if (preset === "month") start.setDate(1);
  if (preset === "year") start.setMonth(0, 1);
  return { startDate: localDay(start), endDate };
}

export default function Surgery() {
  const { user } = useAuth();
  const canChangeCurrency = user?.role === "HOSPITAL_ADMIN";
  const canManageCatalog = user?.role === "HOSPITAL_ADMIN" || user?.role === "ACCOUNTANT";
  const canPrescribe = user?.role === "HOSPITAL_ADMIN" || user?.role === "DOCTOR" || user?.role === "NURSE";
  const [currency, setCurrency] = useState<BillingCurrency>("EUR");
  const [currencies, setCurrencies] = useState<BillingCurrency[]>(["EUR", "CDF", "USD"]);
  const [categories, setCategories] = useState<SurgicalCategory[]>([]);
  const [acts, setActs] = useState<SurgicalAct[]>([]);
  const [prices, setPrices] = useState<SurgicalPriceChange[]>([]);
  const [changes, setChanges] = useState<SurgicalChange[]>([]);
  const [stats, setStats] = useState<SurgeryStats | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [preset, setPreset] = useState("month");
  const [customStart, setCustomStart] = useState(localDay(new Date()));
  const [customEnd, setCustomEnd] = useState(localDay(new Date()));
  const [editing, setEditing] = useState<SurgicalAct | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const emptyForm = { name: "", categoryId: "", description: "", unitPrice: "" };
  const [form, setForm] = useState(emptyForm);
  const [categoryName, setCategoryName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCatalog = async () => {
    const [settings, categoryRows, actRows] = await Promise.all([
      billingService.getSettings(),
      surgeryService.listCategories(),
      surgeryService.listActs(),
    ]);
    setCurrency(settings.currency);
    setCurrencies(settings.currencies);
    setCategories(categoryRows);
    setActs(actRows.data);
  };

  const loadStats = async () => {
    const range = periodRange(preset, customStart, customEnd);
    const params: Record<string, string> = {};
    if (range.startDate) params.startDate = range.startDate;
    if (range.endDate) params.endDate = range.endDate;
    setStats(await surgeryService.stats(params));
  };

  useEffect(() => {
    if (!canManageCatalog) return;
    void loadCatalog().catch((error) => toast.error(apiMessage(error)));
    void surgeryService.priceHistory().then(setPrices).catch((error) => toast.error(apiMessage(error)));
    void surgeryService.changes().then(setChanges).catch((error) => toast.error(apiMessage(error)));
  }, [canManageCatalog]);

  useEffect(() => {
    if (!canManageCatalog) return;
    void loadStats().catch((error) => toast.error(apiMessage(error)));
  }, [canManageCatalog, preset, customStart, customEnd]);

  const refresh = async () => {
    await Promise.all([
      loadCatalog(),
      loadStats(),
      surgeryService.priceHistory().then(setPrices),
      surgeryService.changes().then(setChanges),
    ]);
  };

  const changeCurrency = async (next: BillingCurrency) => {
    try {
      const settings = await billingService.updateSettings(next);
      setCurrency(settings.currency);
      toast.success(`Devise de l'établissement : ${settings.currency}`);
      await refresh();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const saveAct = async () => {
    if (!form.name.trim() || !form.categoryId) {
      toast.error("Le nom et la catégorie sont requis");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        categoryId: form.categoryId,
        description: form.description.trim(),
        ...(form.unitPrice.trim() ? { unitPrice: Number(form.unitPrice) } : {}),
      };
      if (editing) {
        await surgeryService.updateAct(editing.id, payload);
        toast.success("Acte modifié");
      } else {
        await surgeryService.createAct(payload);
        toast.success("Acte ajouté");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setCategoryName("");
      await refresh();
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async () => {
    if (!categoryName.trim()) return;
    try {
      const created = await surgeryService.createCategory(categoryName.trim());
      setCategoryName("");
      setForm((current) => ({ ...current, categoryId: created.id }));
      toast.success("Catégorie ajoutée");
      await refresh();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const toggleAct = async (act: SurgicalAct) => {
    try {
      await surgeryService.updateAct(act.id, { active: !act.active });
      toast.success(act.active ? "Acte désactivé" : "Acte activé");
      await refresh();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const visibleActs = acts.filter((act) => {
    const needle = search.trim().toLocaleLowerCase("fr");
    const matchesSearch = !needle || act.name.toLocaleLowerCase("fr").includes(needle) || act.description.toLocaleLowerCase("fr").includes(needle);
    const matchesCategory = categoryFilter === "all" || act.categoryId === categoryFilter;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "active" && act.active)
      || (statusFilter === "inactive" && !act.active)
      || (statusFilter === "unpriced" && act.unitPrice == null);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setCategoryName("");
    setDialogOpen(true);
  };

  const openEdit = (act: SurgicalAct) => {
    setEditing(act);
    setCategoryName("");
    setForm({
      name: act.name,
      categoryId: act.categoryId,
      description: act.description,
      unitPrice: act.unitPrice == null ? "" : String(act.unitPrice),
    });
    setDialogOpen(true);
  };

  const closeDialog = (open: boolean) => {
    if (saving) return;
    setDialogOpen(open);
    if (!open) {
      setEditing(null);
      setForm(emptyForm);
      setCategoryName("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Actes</h1>
          <p className="mt-1 text-muted-foreground">Recommandez un acte tarifé : il rejoint la facture du patient sans être marqué comme réalisé.</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          {canManageCatalog && <Button variant="hero" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nouvel acte</Button>}
          {canManageCatalog && <div className="space-y-2">
          <Label>Devise de l'établissement</Label>
          {canChangeCurrency ? (
            <Select value={currency} onValueChange={(value) => void changeCurrency(value as BillingCurrency)}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium">{currency}</p>
          )}
          <p className="max-w-sm text-xs text-muted-foreground">Les factures déjà créées gardent leur devise. Un acte change de devise seulement quand son prix est ressaisi.</p>
        </div>}
        </div>
      </div>

      {canPrescribe && <ActRecommendations />}

      {canManageCatalog && <Tabs defaultValue="dashboard">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="catalog">Catalogue</TabsTrigger>
          <TabsTrigger value="prices">Historique des tarifs</TabsTrigger>
          <TabsTrigger value="changes">Modifications</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
                <SelectItem value="year">Cette année</SelectItem>
                <SelectItem value="custom">Période personnalisée</SelectItem>
              </SelectContent>
            </Select>
            {preset === "custom" && (
              <>
                <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
                <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
              </>
            )}
          </div>
          {stats && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Actes enregistrés</p><p className="text-2xl font-bold">{stats.acts.total}</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Actes actifs</p><p className="text-2xl font-bold">{stats.acts.active}</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Actes inactifs</p><p className="text-2xl font-bold">{stats.acts.inactive}</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Facturé ({stats.currency})</p><p className="text-2xl font-bold">{formatMoney(stats.billed.amount, stats.currency)}</p><p className="text-xs text-muted-foreground">{stats.billed.quantity} acte(s)</p></CardContent></Card>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <p className="font-medium">Actes les plus facturés</p>
                    {stats.topActs.length === 0 && <p className="text-sm text-muted-foreground">Aucune facture finalisée sur cette période.</p>}
                    {stats.topActs.map((act) => (
                      <div key={act.actId} className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium">{act.name}</p>
                          <p className="text-muted-foreground">{act.categoryName} · {act.quantity}</p>
                        </div>
                        <p className="font-medium">{formatMoney(act.amount, stats.currency)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <p className="font-medium">Par catégorie</p>
                    {stats.byCategory.length === 0 && <p className="text-sm text-muted-foreground">Pas encore de facturation chirurgicale.</p>}
                    {stats.byCategory.map((category) => (
                      <div key={category.name} className="flex items-center justify-between text-sm">
                        <span>{category.name}</span>
                        <span className="font-medium">{formatMoney(category.amount, stats.currency)}</span>
                      </div>
                    ))}
                    {stats.otherCurrencies.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        D'autres factures de la période sont dans une autre devise et ne sont pas additionnées : {stats.otherCurrencies.map((entry) => `${formatMoney(entry.amount, entry.currency)}`).join(", ")}.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardContent className="space-y-2 pt-6">
                  <p className="font-medium">Évolution</p>
                  {stats.evolution.length === 0 && <p className="text-sm text-muted-foreground">Aucune facturation sur la période.</p>}
                  {stats.evolution.map((point) => (
                    <div key={point.date} className="flex items-center justify-between text-sm">
                      <span>{new Date(`${point.date}T00:00:00`).toLocaleDateString("fr-FR")}</span>
                      <span>{point.quantity} · {formatMoney(point.amount, stats.currency)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Rechercher un acte" value={search} onChange={(event) => setSearch(event.target.value)} />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
                <SelectItem value="unpriced">Sans tarif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3">
            {visibleActs.map((act) => (
              <Card key={act.id}>
                <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{act.name}</p>
                      <Badge variant={act.active ? "secondary" : "outline"}>{act.active ? "Actif" : "Inactif"}</Badge>
                      {act.unitPrice == null && <Badge variant="outline">Sans tarif</Badge>}
                      {act.currency && act.currency !== currency && <Badge variant="outline">Tarif en {act.currency}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{act.categoryName}</p>
                    <p className="text-sm text-muted-foreground">{act.description}</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <p className="font-semibold">{act.unitPrice == null ? "Tarif à saisir" : formatMoney(act.unitPrice, act.currency || currency)}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => openEdit(act)}>Modifier</Button>
                      <Button variant="outline" onClick={() => void toggleAct(act)}>{act.active ? "Désactiver" : "Activer"}</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="prices" className="space-y-3">
          {prices.length === 0 && <p className="text-sm text-muted-foreground">Aucun tarif n'a encore été saisi.</p>}
          {prices.map((change) => (
            <Card key={change.id}>
              <CardContent className="pt-6 text-sm">
                <p className="font-medium">{change.actName}</p>
                <p className="text-muted-foreground">
                  {change.previousPrice == null ? "Tarif initial" : `Ancien tarif : ${formatMoney(change.previousPrice, change.previousCurrency || change.nextCurrency)}`}
                  {" · "}Nouveau tarif : {formatMoney(change.nextPrice, change.nextCurrency)}
                </p>
                <p className="text-muted-foreground">
                  {new Date(change.changedAt).toLocaleString("fr-FR")} · {change.changedByName || "Utilisateur"}
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="changes" className="space-y-3">
          {changes.length === 0 && <p className="text-sm text-muted-foreground">Aucune modification enregistrée.</p>}
          {changes.map((change) => (
            <Card key={change.id}>
              <CardContent className="pt-6 text-sm">
                <p className="font-medium">{actionLabels[change.action] || change.action}{change.metadata.name ? ` · ${change.metadata.name}` : ""}</p>
                <p className="text-muted-foreground">
                  {change.metadata.changes?.length ? change.metadata.changes.join(", ") : "Création"}
                  {" · "}{new Date(change.createdAt).toLocaleString("fr-FR")}
                  {" · "}{change.actorName || "Utilisateur"}
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>}

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'acte" : "Nouvel acte"}</DialogTitle>
            <DialogDescription>Laissez le prix vide pour l'enregistrer plus tard. Aucun tarif n'est inventé.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nom</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={form.categoryId} onValueChange={(categoryId) => setForm({ ...form, categoryId })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Prix ({currency})</Label><Input type="number" min={0} step="0.01" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} placeholder="À renseigner" /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input placeholder="Nouvelle catégorie" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
              <Button type="button" variant="outline" onClick={() => void addCategory()}>Ajouter la catégorie</Button>
            </div>
            <Button variant="hero" className="w-full" disabled={saving} onClick={() => void saveAct()}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
