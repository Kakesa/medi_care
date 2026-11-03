import { useEffect, useState } from "react";
import { 
  FlaskConical, 
  Search, 
  Plus, 
  FileImage, 
  TestTube,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { examCategories } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { useAckExamResults } from "@/contexts/WorkBadgeContext";
import { chargeService, type CatalogOption, type PatientChargeRecord } from "@/services/chargeService";
import { examService, type ExamCatalogItem } from "@/services/examService";
import { billingService } from "@/services/billingService";
import { formatMoney, type BillingCurrency } from "@/lib/money";
import { patientService } from "@/services/patientService";
import { personnelService } from "@/services/personnelService";
import { surgeryService, type SurgicalAct } from "@/services/surgeryService";
import type { Exam, Patient, Personnel } from "@/types";
import { apiMessage } from "@/lib/apiError";
import { toast } from "sonner";

function CatalogGrid({ items, currency, empty }: { items: ExamCatalogItem[]; currency: string; empty?: boolean }) {
  if (items.length === 0) {
    return empty ? <p className="text-sm text-muted-foreground">Aucun examen dans cette catégorie.</p> : null;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <Card key={`${item.type}-${item.id}`} className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{item.name}</h3>
                  <Badge variant="outline">{item.type === "imaging" ? "Imagerie" : "Laboratoire"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.categoryName}</p>
                {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{item.unitPrice == null ? "—" : formatMoney(item.unitPrice, item.currency || currency)}</p>
                {item.createdAt && <p className="text-xs text-muted-foreground">Créé le {new Date(item.createdAt).toLocaleDateString("fr-FR")}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ExamSums({ charges }: { charges: PatientChargeRecord[] }) {
  const groups = new Map<string, { name: string; currency: string; total: number; lines: PatientChargeRecord[] }>();
  for (const charge of charges) {
    const current = groups.get(charge.patientId) || { name: charge.patientName, currency: charge.currency, total: 0, lines: [] };
    current.total += charge.total;
    current.lines.push(charge);
    groups.set(charge.patientId, current);
  }
  if (groups.size === 0) {
    return <p className="text-sm text-muted-foreground">Aucun examen recommandé pour le moment.</p>;
  }
  return (
    <div className="space-y-4">
      {[...groups.values()].map((group) => (
        <Card key={group.name}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span>{group.name}</span>
              <span>{formatMoney(group.total, group.currency)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.lines.map((line) => (
              <div key={line.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{line.label}</span>
                <span className="shrink-0">{formatMoney(line.total, line.currency)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const labCategoryNames = new Set([
  "Hématologie",
  "Parasitologie",
  "Urine complète",
  "LCR et liquides de ponction",
  "Biochimie",
  "Ionogramme",
  "Sérologie",
  "Hormonologie",
  "Bactériologie",
  "Histopathologie",
]);

export default function Examinations() {
  const { user } = useAuth();
  const seesPrices = user?.role === "HOSPITAL_ADMIN" || user?.role === "ACCOUNTANT" || user?.role === "RECEPTIONIST";
  const canChangeCurrency = user?.role === "HOSPITAL_ADMIN";
  const canPlan = user?.role === "HOSPITAL_ADMIN" || user?.role === "DOCTOR" || user?.role === "NURSE";
  const currencies: BillingCurrency[] = ["EUR", "CDF", "USD"];
  const [exams, setExams] = useState<Exam[]>([]);
  useAckExamResults(exams.flatMap((exam) => (exam.results ? [exam.id] : [])));
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Personnel[]>([]);
  const [tariffs, setTariffs] = useState<CatalogOption[]>([]);
  const [labActs, setLabActs] = useState<SurgicalAct[]>([]);
  const [catalogExams, setCatalogExams] = useState<ExamCatalogItem[]>([]);
  const [orgCurrency, setOrgCurrency] = useState("EUR");
  const [charges, setCharges] = useState<PatientChargeRecord[]>([]);
  const [sumPatientId, setSumPatientId] = useState("");
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [tariffSearch, setTariffSearch] = useState("");
  const [selectedTariffIds, setSelectedTariffIds] = useState<string[]>([]);
  const [examPickerSearch, setExamPickerSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const [formData, setFormData] = useState({
    patientId: "",
    doctorId: "",
    type: "laboratory" as Exam['type'],
    category: "",
    name: "",
    date: "",
    notes: "",
    results: "",
    billableServiceId: ""
  });

  const loadExams = async () => {
    try {
      if (user?.role === "ACCOUNTANT") {
        const examResult = await examService.getAll({ limit: 100 });
        setExams(examResult.data);
        return;
      }
      const [examResult, patientResult, doctorResult] = await Promise.all([
        examService.getAll({ limit: 100 }),
        patientService.getAll({ limit: 100 }),
        personnelService.getDoctors(),
      ]);
      setExams(examResult.data);
      setPatients(patientResult.data);
      setDoctors(doctorResult);
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const loadPrices = async () => {
    if (!seesPrices) return;
    try {
      const result = await surgeryService.listActs();
      setOrgCurrency(result.currency);
      setLabActs(result.data.filter((act) => act.billingCategory === "LABORATOIRE" || act.billingCategory === "IMAGERIE" || labCategoryNames.has(act.categoryName)));
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const loadCharges = async (patientId?: string) => {
    if (user?.role === "DOCTOR" && !patientId) {
      setCharges([]);
      return;
    }
    try {
      setCharges(await chargeService.list(patientId));
    } catch {
      setCharges([]);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadExams();
    void loadPrices();
    void examService.catalog().then((result) => {
      setOrgCurrency(result.currency);
      setCatalogExams(result.items);
    }).catch((error) => toast.error(apiMessage(error)));
    if (user.role !== "DOCTOR") void loadCharges();
    if (user.role !== "ACCOUNTANT" && user.role !== "RECEPTIONIST") {
      void chargeService.catalog().then((result) => setTariffs(result.items)).catch(() => setTariffs([]));
    }
  }, [user?.role]);

  const examTariffs = tariffs.filter((item) => {
    if (formData.type === "laboratory") return item.category === "LABORATOIRE";
    if (item.kind !== "service") return false;
    if (formData.type === "imaging") return item.category === "IMAGERIE";
    if (formData.type === "biopsy") return item.category === "ACTE_MEDICAL";
    return ["SOINS_INFIRMIERS", "AUTRE", "REEDUCATION", "ACTE_MEDICAL"].includes(item.category);
  });

  const filteredExams = exams.filter(exam => {
    const matchesSearch = 
      exam.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || exam.type === typeFilter;
    const matchesStatus = statusFilter === "all" || exam.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const laboratoryExams = filteredExams.filter(e => e.type === 'laboratory');
  const imagingExams = filteredExams.filter(e => e.type === 'imaging');
  const catalogQuery = searchTerm.toLowerCase();
  const visibleCatalog = catalogExams.filter((item) =>
    item.name.toLowerCase().includes(catalogQuery) ||
    item.categoryName.toLowerCase().includes(catalogQuery) ||
    item.description.toLowerCase().includes(catalogQuery)
  );
  const laboratoryCatalog = visibleCatalog.filter((item) => item.type === "laboratory");
  const imagingCatalog = visibleCatalog.filter((item) => item.type === "imaging");

  const typeLabel = (type: string) => type === "imaging" ? "Imagerie" : type === "laboratory" ? "Laboratoire" : "Autre";

  const resetForm = () => {
    setFormData({
      patientId: "",
      doctorId: "",
      type: "laboratory",
      category: "",
      name: "",
      date: "",
      notes: "",
      results: "",
      billableServiceId: ""
    });
    setSelectedTariffIds([]);
    setExamPickerSearch("");
    setEditingExam(null);
  };

  const reloadCatalog = async () => {
    const result = await examService.catalog();
    setOrgCurrency(result.currency);
    setCatalogExams(result.items);
  };

  const changeCurrency = async (next: BillingCurrency) => {
    try {
      const settings = await billingService.updateSettings(next);
      setOrgCurrency(settings.currency);
      toast.success(`Devise de l'établissement : ${settings.currency}`);
      await reloadCatalog();
      if (seesPrices) await loadPrices();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const transmitCatalogExam = async (item: ExamCatalogItem) => {
    const priced = item.unitPrice != null && (!item.currency || item.currency === orgCurrency);
    await examService.create({
      patientId: formData.patientId,
      patientName: "",
      doctorId: formData.doctorId,
      doctorName: "",
      type: item.type,
      category: item.categoryName || formData.category || "Laboratoire",
      name: item.name,
      date: formData.date,
      notes: formData.notes || undefined,
      billableServiceId: item.kind === "service" && priced ? item.id : undefined,
    });
    if (item.kind === "surgery" && priced) {
      await chargeService.recommend({
        patientId: formData.patientId,
        catalogKind: "surgery",
        catalogItemId: item.id,
        quantity: 1,
        idempotencyKey: crypto.randomUUID(),
      });
    }
    return priced;
  };

  const transmitTariff = async (tariff: CatalogOption) => {
    await examService.create({
      patientId: formData.patientId,
      patientName: "",
      doctorId: formData.doctorId,
      doctorName: "",
      type: formData.type,
      category: tariff.categoryLabel || formData.category || "Laboratoire",
      name: tariff.name,
      date: formData.date,
      notes: formData.notes || undefined,
      billableServiceId: tariff.kind === "service" ? tariff.id : undefined,
    });
    if (tariff.kind === "surgery") {
      await chargeService.recommend({
        patientId: formData.patientId,
        catalogKind: "surgery",
        catalogItemId: tariff.id,
        quantity: 1,
        idempotencyKey: crypto.randomUUID(),
      });
    }
  };

  const handleSubmit = async () => {
    const catalogPick = formData.type === "laboratory" || formData.type === "imaging";
    const picked = catalogExams.filter((item) => item.type === formData.type && selectedTariffIds.includes(item.id));
    const planningSeveral = !editingExam && catalogPick && picked.length > 0;
    if (!formData.patientId || !formData.doctorId || !formData.date) {
      toast.error("Veuillez sélectionner un patient, un médecin et une date");
      return;
    }
    if (!editingExam && catalogPick && picked.length === 0) {
      toast.error("Sélectionnez au moins un examen");
      return;
    }
    if (!planningSeveral && (!formData.name || !formData.category)) {
      toast.error("Veuillez indiquer la catégorie et le nom de l'examen");
      return;
    }

    try {
      if (editingExam) {
        await examService.update(editingExam.id, {
          patientId: formData.patientId,
          patientName: "",
          doctorId: formData.doctorId,
          doctorName: "",
          type: formData.type,
          category: formData.category,
          name: formData.name,
          date: formData.date,
          notes: formData.notes || undefined,
        });
        toast.success("Examen modifié avec succès");
      } else if (planningSeveral) {
        let billed = 0;
        const failures: string[] = [];
        for (const item of picked) {
          try {
            if (await transmitCatalogExam(item)) billed += 1;
          } catch {
            failures.push(item.name);
          }
        }
        if (failures.length > 0) {
          toast.error(`Non enregistrés : ${failures.join(", ")}`);
        } else if (billed === picked.length) {
          toast.success(picked.length > 1 ? "Examens transmis à la facturation" : "Examen transmis à la facturation");
        } else if (billed === 0) {
          toast.success("Examens recommandés. Enregistrez leur prix pour les ajouter à la facture.");
        } else {
          toast.success(`${billed} examen(s) transmis. Les autres sont recommandés sans tarif.`);
        }
        setSumPatientId(formData.patientId);
        await loadCharges(formData.patientId);
      } else {
        const tariff = examTariffs.find((item) => item.id === formData.billableServiceId);
        if (tariff?.kind === "surgery") {
          await transmitTariff(tariff);
        } else {
          await examService.create({
            patientId: formData.patientId,
            patientName: "",
            doctorId: formData.doctorId,
            doctorName: "",
            type: formData.type,
            category: formData.category,
            name: formData.name,
            date: formData.date,
            notes: formData.notes || undefined,
            billableServiceId: formData.billableServiceId || undefined,
          });
        }
        if (tariff) {
          setSumPatientId(formData.patientId);
          await loadCharges(formData.patientId);
        }
        toast.success(tariff ? "Examen transmis à la facturation" : "Examen recommandé");
      }
      setIsDialogOpen(false);
      resetForm();
      await loadExams();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      patientId: exam.patientId,
      doctorId: exam.doctorId,
      type: exam.type,
      category: exam.category,
      name: exam.name,
      date: exam.date,
      notes: exam.notes || "",
      billableServiceId: "",
      results: exam.results || ""
    });
    setSelectedTariffIds([]);
    setIsDialogOpen(true);
  };

  const savePrice = async (act: SurgicalAct) => {
    const raw = priceDrafts[act.id] ?? (act.unitPrice == null ? "" : String(act.unitPrice));
    const unitPrice = Number(raw.replace(",", "."));
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error("Indiquez le prix de l'examen");
      return;
    }
    try {
      await surgeryService.updateAct(act.id, { unitPrice });
      toast.success("Prix enregistré");
      await loadPrices();
      const result = await chargeService.catalog().catch(() => null);
      if (result) setTariffs(result.items);
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const handleDelete = async (examId: string) => {
    try {
      await examService.delete(examId);
      toast.success("Examen supprimé");
      await loadExams();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const handleStatusChange = async (examId: string, status: Exam['status']) => {
    try {
      await examService.updateStatus(examId, status);
      toast.success("Statut mis à jour");
      await loadExams();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const handleAddResults = async (examId: string, results: string) => {
    try {
      await examService.addResults(examId, results);
      toast.success("Résultats ajoutés");
      setSelectedExam(null);
      await loadExams();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "En attente" },
      in_progress: { variant: "default", label: "En cours" },
      completed: { variant: "outline", label: "Terminé" },
      cancelled: { variant: "destructive", label: "Annulé" }
    };
    const { variant, label } = variants[status] || { variant: "outline", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'laboratory': return <TestTube className="h-5 w-5 text-success" />;
      case 'imaging': return <FileImage className="h-5 w-5 text-info" />;
      default: return <FlaskConical className="h-5 w-5 text-primary" />;
    }
  };

  const ExamCard = ({ exam }: { exam: Exam }) => (
    <Card className="card-elevated">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
              {getTypeIcon(exam.type)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{exam.name}</h3>
                <Badge variant="outline">{typeLabel(exam.type)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{exam.category}</p>
              <p className="text-sm font-medium mt-1">{exam.patientName}</p>
              <p className="text-xs text-muted-foreground">{exam.doctorName}</p>
            </div>
          </div>
          <div className="text-right space-y-2">
            {getStatusBadge(exam.status)}
            <p className="text-xs text-muted-foreground">{exam.date}</p>
          </div>
        </div>

        {exam.results && (
          <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20">
            <p className="text-xs font-medium text-success mb-1">Résultats</p>
            <p className="text-sm text-muted-foreground">{exam.results}</p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={() => setSelectedExam(exam)}>
            <Eye className="h-4 w-4 mr-1" />
            Détails
          </Button>
          {canPlan && exam.status !== 'completed' && (
            <Button variant="outline" size="sm" onClick={() => handleEdit(exam)}>
              <Edit className="h-4 w-4 mr-1" />
              Modifier
            </Button>
          )}
          {canPlan && !exam.results && exam.status !== 'cancelled' && (
            <Select onValueChange={(value) => handleStatusChange(exam.id, value as Exam['status'])}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          )}
          {canPlan && user?.role === "HOSPITAL_ADMIN" && <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer l'examen ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(exam.id)}>
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Examens</h1>
          <p className="mt-1 text-muted-foreground">
            Gestion des examens de laboratoire et imagerie médicale
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="space-y-2">
            <Label>Devise de l'établissement</Label>
            {canChangeCurrency ? (
              <Select value={orgCurrency} onValueChange={(value) => void changeCurrency(value as BillingCurrency)}>
                <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-medium">{orgCurrency}</p>
            )}
            <p className="max-w-sm text-xs text-muted-foreground">Les factures déjà créées gardent leur devise. Un examen change de devise seulement quand son prix est ressaisi.</p>
          </div>
        {canPlan && <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Recommander un examen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingExam ? 'Modifier l\'examen' : 'Recommander un examen'}</DialogTitle>
              <DialogDescription>
                {editingExam ? 'Modifiez les informations de l\'examen' : 'Choisissez le patient et les examens à recommander'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Patient</Label>
                <Select value={formData.patientId} onValueChange={(v) => setFormData({...formData, patientId: v})}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un patient" /></SelectTrigger>
                  <SelectContent>
                    {patients.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Médecin prescripteur</Label>
                <Select value={formData.doctorId} onValueChange={(v) => setFormData({...formData, doctorId: v})}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un médecin" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map(d => (
                      <SelectItem key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => { setSelectedTariffIds([]); setFormData({...formData, type: v as Exam['type'], category: "", billableServiceId: ""}); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laboratory">Laboratoire</SelectItem>
                      <SelectItem value="imaging">Imagerie</SelectItem>
                      <SelectItem value="biopsy">Biopsie</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
              {(editingExam || (formData.type !== "laboratory" && formData.type !== "imaging")) && <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger>
                  <SelectContent>
                    {examCategories[formData.type]?.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>}
              {(formData.type === "laboratory" || formData.type === "imaging") && !editingExam ? (
                <div className="space-y-2">
                  <Label>Examens à recommander</Label>
                  <Input
                    value={examPickerSearch}
                    onChange={(event) => setExamPickerSearch(event.target.value)}
                    placeholder="Rechercher un examen"
                  />
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {catalogExams.filter((item) => item.type === formData.type && (item.name.toLowerCase().includes(examPickerSearch.toLowerCase()) || item.categoryName.toLowerCase().includes(examPickerSearch.toLowerCase()))).length === 0 ? (
                      <p className="px-2 py-3 text-sm text-muted-foreground">Aucun examen dans cette catégorie.</p>
                    ) : catalogExams
                      .filter((item) => item.type === formData.type && (item.name.toLowerCase().includes(examPickerSearch.toLowerCase()) || item.categoryName.toLowerCase().includes(examPickerSearch.toLowerCase())))
                      .map((item) => {
                      const checked = selectedTariffIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedTariffIds((current) => checked ? current.filter((id) => id !== item.id) : [...current, item.id])}
                          className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm ${checked ? "bg-primary/10" : "hover:bg-muted"}`}
                        >
                          <span>
                            <span className="block font-medium">{item.name}</span>
                            <span className="text-xs text-muted-foreground">{item.categoryName}</span>
                          </span>
                          <span className="shrink-0 font-medium">{item.unitPrice == null ? "—" : formatMoney(item.unitPrice, item.currency || orgCurrency)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedTariffIds.filter((id) => catalogExams.some((item) => item.id === id && item.type === formData.type)).length} examen(s) sélectionné(s). La somme se trouve dans l'onglet Somme.</p>
                </div>
              ) : (
              <div className="space-y-2">
                <Label>Tarif du catalogue</Label>
                <Select
                  value={formData.billableServiceId || "none"}
                  onValueChange={(value) => {
                    const billableServiceId = value === "none" ? "" : value;
                    const tariff = examTariffs.find((item) => item.id === billableServiceId);
                    setFormData({
                      ...formData,
                      billableServiceId,
                      name: formData.name || tariff?.name || "",
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir un tarif" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ne pas facturer</SelectItem>
                    {examTariffs.map((tariff) => (
                      <SelectItem key={tariff.id} value={tariff.id}>{tariff.name} · {formatMoney(tariff.unitPrice, tariff.currency)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {examTariffs.find((item) => item.id === formData.billableServiceId) && (
                  <p className="text-sm font-medium">
                    Prix : {formatMoney(
                      examTariffs.find((item) => item.id === formData.billableServiceId)!.unitPrice,
                      examTariffs.find((item) => item.id === formData.billableServiceId)!.currency
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Le prix vient du catalogue. L'examen transmis reste recommandé tant qu'il n'est pas réalisé.</p>
              </div>
              )}
              {(editingExam || (formData.type !== "laboratory" && formData.type !== "imaging")) && <div className="space-y-2">
                <Label>Nom de l'examen</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Ex: Bilan sanguin complet" />
              </div>}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="Instructions ou notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleSubmit}>{editingExam ? 'Modifier' : 'Recommander'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par patient, examen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="completed">Terminés</SelectItem>
            <SelectItem value="cancelled">Annulés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">Tous ({visibleCatalog.length + filteredExams.length})</TabsTrigger>
          <TabsTrigger value="laboratory">
            <TestTube className="h-4 w-4 mr-1" />
            Laboratoire ({laboratoryCatalog.length + laboratoryExams.length})
          </TabsTrigger>
          <TabsTrigger value="imaging">
            <FileImage className="h-4 w-4 mr-1" />
            Imagerie ({imagingCatalog.length + imagingExams.length})
          </TabsTrigger>
          <TabsTrigger value="somme">Somme</TabsTrigger>
          {seesPrices && <TabsTrigger value="tarifs">Tarifs</TabsTrigger>}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <CatalogGrid items={visibleCatalog} currency={orgCurrency} empty={filteredExams.length === 0} />
          {filteredExams.length > 0 && (
            <>
              <h2 className="text-lg font-semibold">Examens des patients</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {filteredExams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="laboratory" className="space-y-4">
          <CatalogGrid items={laboratoryCatalog} currency={orgCurrency} empty={laboratoryExams.length === 0} />
          {laboratoryExams.length > 0 && (
            <>
              <h2 className="text-lg font-semibold">Examens des patients</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {laboratoryExams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="imaging" className="space-y-4">
          <CatalogGrid items={imagingCatalog} currency={orgCurrency} empty={imagingExams.length === 0} />
          {imagingExams.length > 0 && (
            <>
              <h2 className="text-lg font-semibold">Examens des patients</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {imagingExams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="somme" className="space-y-4">
          {patients.length > 0 && (
            <Select
              value={sumPatientId || "none"}
              onValueChange={(value) => {
                const patientId = value === "none" ? "" : value;
                setSumPatientId(patientId);
                void loadCharges(patientId || undefined);
              }}
            >
              <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Patient" /></SelectTrigger>
              <SelectContent>
                {user?.role !== "DOCTOR" && <SelectItem value="none">Tous les patients visibles</SelectItem>}
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {user?.role === "DOCTOR" && !sumPatientId ? (
            <p className="text-sm text-muted-foreground">Choisissez un patient pour voir la somme de ses examens.</p>
          ) : (
            <ExamSums charges={charges.filter((charge) => charge.category === "LABORATOIRE" && charge.realizationStatus !== "cancelled")} />
          )}
        </TabsContent>

        {seesPrices && (
          <TabsContent value="tarifs" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un examen"
                value={tariffSearch}
                onChange={(event) => setTariffSearch(event.target.value)}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {labActs
                .filter((act) => act.name.toLowerCase().includes(tariffSearch.toLowerCase()) || act.categoryName.toLowerCase().includes(tariffSearch.toLowerCase()))
                .map((act) => (
                  <div key={act.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{act.name}</p>
                        <Badge variant="outline">{act.billingCategory === "IMAGERIE" ? "Imagerie" : "Laboratoire"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{act.categoryName}{act.description ? ` · ${act.description}` : ""}</p>
                      {act.createdAt && <p className="text-xs text-muted-foreground">Créé le {new Date(act.createdAt).toLocaleDateString("fr-FR")}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        className="w-28"
                        inputMode="decimal"
                        value={priceDrafts[act.id] ?? (act.unitPrice == null ? "" : String(act.unitPrice))}
                        onChange={(event) => setPriceDrafts((current) => ({ ...current, [act.id]: event.target.value }))}
                        placeholder="Prix"
                      />
                      <span className="w-28 text-sm font-medium">
                        {act.unitPrice == null ? "—" : formatMoney(act.unitPrice, act.currency || orgCurrency)}
                      </span>
                      <Button type="button" variant="outline" size="sm" onClick={() => void savePrice(act)}>Enregistrer</Button>
                    </div>
                  </div>
                ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Exam details dialog */}
      <Dialog open={!!selectedExam} onOpenChange={() => setSelectedExam(null)}>
        <DialogContent className="max-w-lg">
          {selectedExam && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getTypeIcon(selectedExam.type)}
                  {selectedExam.name}
                </DialogTitle>
                <DialogDescription>{selectedExam.category}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Patient</p>
                    <p className="font-medium">{selectedExam.patientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Prescripteur</p>
                    <p className="font-medium">{selectedExam.doctorName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{selectedExam.date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Statut</p>
                    {getStatusBadge(selectedExam.status)}
                  </div>
                </div>
                
                {selectedExam.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm">{selectedExam.notes}</p>
                  </div>
                )}

                {selectedExam.results ? (
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-sm font-medium text-success mb-2">Résultats</p>
                    <p className="text-sm">{selectedExam.results}</p>
                    <Button variant="outline" size="sm" className="mt-3">
                      <Download className="h-4 w-4 mr-1" />
                      Télécharger
                    </Button>
                  </div>
                ) : canPlan ? (
                  <div className="space-y-2">
                    <Label>Ajouter les résultats</Label>
                    <Textarea 
                      id="results-input"
                      placeholder="Saisir les résultats de l'examen..."
                    />
                    <Button 
                      size="sm"
                      onClick={() => {
                        const input = document.getElementById('results-input') as HTMLTextAreaElement;
                        if (input?.value) return handleAddResults(selectedExam.id, input.value);
                      }}
                    >
                      Enregistrer les résultats
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}