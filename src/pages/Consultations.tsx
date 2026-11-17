import { useEffect, useState } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Stethoscope,
  User,
  Calendar,
  Clock,
  CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import OrdonnanceEditor from "@/components/consultations/OrdonnanceEditor";
import { PatientSelect } from "@/components/patients/PatientSelect";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { consultationService } from "@/services/consultationService";
import { examService, type ExamCatalogItem } from "@/services/examService";
import { patientService } from "@/services/patientService";
import { personnelService } from "@/services/personnelService";
import { prescriptionService } from "@/services/prescriptionService";
import type { Consultation, Patient, Personnel } from "@/types";
import { apiMessage } from "@/lib/apiError";
import { blankLine, lineFromItem, linesFromText, prescriptionText, rhythmOf, type OrdonnanceLine, type OrdonnanceSheet } from "@/utils/ordonnance";

const statusConfig = {
  in_progress: { label: "En cours", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  completed: { label: "Terminée", color: "bg-success/10 text-success border-success/20", icon: CheckCircle }
};

function ageOf(date?: string) {
  if (!date) return "—";
  const born = new Date(date);
  if (Number.isNaN(born.getTime())) return "—";
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) years -= 1;
  return years >= 0 ? `${years} ans` : "—";
}

function sexOf(gender?: string) {
  if (gender === "M") return "masculin";
  if (gender === "F") return "féminin";
  return "sexe non renseigné";
}

function itemsPayload(lines: OrdonnanceLine[]) {
  return lines.filter((line) => line.medication.trim()).map((line) => {
    const rhythm = rhythmOf(line);
    const route = line.route.trim();
    return {
      medication: line.medication.trim(),
      dosage: line.dosage.trim() || "Selon prescription",
      posology: rhythm || "Selon prescription",
      form: line.form,
      ...(rhythm ? { frequency: rhythm } : {}),
      duration: line.duration.trim() || "Selon prescription",
      ...(route.length >= 2 ? { administrationRoute: route } : {}),
      ...(line.instructions.trim() ? { instructions: line.instructions.trim() } : {}),
      quantityPrescribed: Math.max(1, Number(line.quantity) || 1),
    };
  });
}

export default function Consultations() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canWrite = user?.role === "HOSPITAL_ADMIN" || user?.role === "DOCTOR";
  const canDelete = user?.role === "HOSPITAL_ADMIN";
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Personnel[]>([]);
  const [examCatalog, setExamCatalog] = useState<ExamCatalogItem[]>([]);
  const [examQuery, setExamQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [detailLines, setDetailLines] = useState<OrdonnanceLine[]>([blankLine()]);
  const [detailNotes, setDetailNotes] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Consultation | null>(null);
  const [formLines, setFormLines] = useState<OrdonnanceLine[]>([blankLine()]);
  const [formRecommendations, setFormRecommendations] = useState("");
  
  const emptyForm = {
    patientId: "",
    doctorId: "",
    plainte: "",
    histoireMaladie: "",
    antecedent: "",
    comportementAnamnese: "",
    examenPhysique: "",
    conclusion: "",
    allergies: "",
    recommandationExamens: [] as string[],
    followUpDate: "",
  };
  const [formData, setFormData] = useState(emptyForm);

  const loadConsultations = async () => {
    try {
      const [consultationResult, patientResult, doctorResult] = await Promise.all([
        consultationService.getAll({ limit: 100 }),
        patientService.getAll({ limit: 100 }),
        personnelService.getDoctors(),
      ]);
      setConsultations(consultationResult.data);
      setPatients(patientResult.data);
      setDoctors(doctorResult);
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  useEffect(() => {
    if (!isDialogOpen || editingId || formData.doctorId || user?.role !== "DOCTOR") return;
    const mine = doctors.find((doctor) => doctor.userId === user.id);
    if (mine) setFormData((current) => current.doctorId ? current : { ...current, doctorId: mine.id });
  }, [isDialogOpen, editingId, formData.doctorId, doctors, user]);

  useEffect(() => {
    void loadConsultations();
    void examService.catalog()
      .then((result) => setExamCatalog(result.items))
      .catch(() => setExamCatalog([]));
  }, []);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const recommendationText = () => examCatalog
    .filter((item) => formData.recommandationExamens.includes(item.id))
    .map((item) => item.name)
    .join("\n");

  const closeForm = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setExamQuery("");
    setFormData(emptyForm);
    setFormLines([blankLine()]);
    setFormRecommendations("");
  };

  const openCreate = () => {
    const mine = user?.role === "DOCTOR" ? doctors.find((doctor) => doctor.userId === user.id) : undefined;
    setEditingId(null);
    setExamQuery("");
    setFormData({ ...emptyForm, doctorId: mine?.id || "" });
    setFormLines([blankLine()]);
    setFormRecommendations("");
    setIsDialogOpen(true);
  };

  const loadOrdonnance = async (consultation: Consultation, target: "form" | "detail") => {
    const apply = (lines: OrdonnanceLine[], notes: string) => {
      if (target === "form") {
        setFormLines(lines);
        setFormRecommendations(notes);
      } else {
        setDetailLines(lines);
        setDetailNotes(notes);
      }
    };
    apply(linesFromText(consultation.prescription), "");
    try {
      const rows = await prescriptionService.list({ consultationId: consultation.id });
      const row = rows[0];
      if (row?.items.length) apply(row.items.map(lineFromItem), row.recommendations || "");
    } catch {
      apply(linesFromText(consultation.prescription), "");
    }
  };

  const openDetail = (consultation: Consultation) => {
    setSelectedConsultation(consultation);
    void loadOrdonnance(consultation, "detail");
  };

  const sheetFor = (patientId: string, doctorId: string, date?: string): Omit<OrdonnanceSheet, "lines" | "recommendations"> => {
    const patient = patients.find((item) => item.id === patientId);
    const doctor = doctors.find((item) => item.id === doctorId);
    return {
      organization: {
        name: user?.organization?.name || "Établissement",
        address: user?.organization?.address,
        phone: user?.organization?.phone,
        email: user?.organization?.email,
        city: user?.organization?.city,
        commune: user?.organization?.commune,
        logo: user?.organization?.logo,
        stamp: user?.organization?.stamp,
      },
      patientName: patient ? `${patient.lastName} ${patient.firstName}` : "Patient",
      age: ageOf(patient?.dateOfBirth),
      sex: sexOf(patient?.gender),
      recordNumber: patient ? patient.id.slice(-8).toUpperCase() : "—",
      date: date || new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Kinshasa" }).format(new Date()),
      doctorName: doctor ? `Dr ${doctor.lastName} ${doctor.firstName}` : user ? `${user.firstName} ${user.lastName}` : "Médecin",
      speciality: doctor?.speciality,
    };
  };

  const openEdit = (consultation: Consultation) => {
    const names = new Set(
      (consultation.recommandationExamens ?? "").split("\n").map((name) => name.trim()).filter(Boolean)
    );
    setEditingId(consultation.id);
    setExamQuery("");
    setFormData({
      patientId: consultation.patientId,
      doctorId: consultation.doctorId,
      plainte: consultation.plainte ?? "",
      histoireMaladie: consultation.histoireMaladie ?? "",
      antecedent: consultation.antecedent ?? "",
      comportementAnamnese: consultation.comportementAnamnese ?? "",
      examenPhysique: consultation.examenPhysique ?? "",
      conclusion: consultation.conclusion ?? "",
      allergies: (consultation.allergies ?? []).join(", "),
      recommandationExamens: examCatalog.filter((item) => names.has(item.name)).map((item) => item.id),
      followUpDate: consultation.followUpDate ?? "",
    });
    void loadOrdonnance(consultation, "form");
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.patientId || !formData.doctorId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez sélectionner un patient et un médecin",
      });
      return;
    }

    const clinical = {
      allergies: formData.allergies.split(",").map((item) => item.trim()).filter(Boolean),
      plainte: formData.plainte.trim(),
      histoireMaladie: formData.histoireMaladie.trim(),
      antecedent: formData.antecedent.trim(),
      comportementAnamnese: formData.comportementAnamnese.trim(),
      examenPhysique: formData.examenPhysique.trim(),
      conclusion: formData.conclusion.trim(),
      recommandationExamens: recommendationText(),
      prescription: prescriptionText(formLines),
      followUpDate: formData.followUpDate,
    };

    try {
      const saved = editingId
        ? await consultationService.update(editingId, {
          patientId: formData.patientId,
          doctorId: formData.doctorId,
          ...clinical,
        })
        : await consultationService.create({
          patientId: formData.patientId,
          patientName: "",
          doctorId: formData.doctorId,
          doctorName: "",
          diagnosis: "",
          symptoms: [],
          treatment: "",
          ...clinical,
          plainte: clinical.plainte || undefined,
          histoireMaladie: clinical.histoireMaladie || undefined,
          antecedent: clinical.antecedent || undefined,
          comportementAnamnese: clinical.comportementAnamnese || undefined,
          examenPhysique: clinical.examenPhysique || undefined,
          conclusion: clinical.conclusion || undefined,
          recommandationExamens: clinical.recommandationExamens || undefined,
          prescription: clinical.prescription || undefined,
          followUpDate: clinical.followUpDate || undefined,
        });
      await prescriptionService.saveForConsultation({
        consultationId: saved.id,
        ...(formRecommendations.trim() ? { recommendations: formRecommendations.trim() } : {}),
        items: itemsPayload(formLines),
      });
      toast({
        title: editingId ? "Consultation modifiée" : "Consultation créée",
        description: "L’ordonnance est enregistrée avec la consultation.",
      });
      closeForm();
      await loadConsultations();
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await consultationService.delete(pendingDelete.id);
      toast({ title: "Consultation supprimée", description: "La consultation a été retirée du dossier." });
      setPendingDelete(null);
      if (selectedConsultation?.id === pendingDelete.id) setSelectedConsultation(null);
      await loadConsultations();
    } catch (error) {
      toast({ variant: "destructive", title: "Suppression impossible", description: apiMessage(error) });
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const result = await consultationService.complete(id) as Consultation & {
        handoff?: { invoiceNumbers: string[]; examCount: number; unpriced: number; pharmacyAfterPayment: boolean; pharmacyNow: boolean };
      };
      const handoff = result.handoff;
      const invoiceText = handoff?.invoiceNumbers.length
        ? `Facture ${handoff.invoiceNumbers.join(", ")} envoyée à la réception pour le paiement des examens.`
        : "La consultation a été marquée comme terminée.";
      const pharmacyText = handoff?.pharmacyAfterPayment
        ? " Après encaissement, orientez le patient vers la pharmacie."
        : handoff?.pharmacyNow
          ? " Le patient peut aller à la pharmacie."
          : "";
      const unpricedText = handoff?.unpriced ? ` ${handoff.unpriced} examen(s) sans tarif n'ont pas été facturés.` : "";
      toast({
        title: "Consultation terminée",
        description: `${invoiceText}${pharmacyText}${unpricedText}`,
      });
      await loadConsultations();
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  const visibleExams = examCatalog.filter((item) => {
    const query = examQuery.trim().toLowerCase();
    return !query || item.name.toLowerCase().includes(query) || item.categoryName.toLowerCase().includes(query);
  });

  const filteredConsultations = consultations.filter(c =>
    c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.plainte ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.conclusion ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.recommandationExamens ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 mb-4 space-y-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:-mx-6 md:mb-6 md:space-y-4 md:px-6 md:py-3">
      <div className="flex items-center justify-between gap-2 sm:items-end">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary md:text-sm md:normal-case md:tracking-normal">Clinique</p>
          <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground md:text-3xl">Consultation</h1>
          <p className="hidden text-muted-foreground md:mt-1 md:block">
            Gestion des consultations et diagnostics
          </p>
        </div>
        {canWrite && (
          <Button variant="hero" size="sm" className="shrink-0 md:h-11 md:px-5" onClick={openCreate}>
            <Plus className="h-4 w-4 md:mr-2 md:h-5 md:w-5" />
            <span className="ml-1 md:ml-0">Nouvelle</span>
          </Button>
        )}
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier la consultation" : "Nouvelle consultation"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Mettez à jour le dossier de cette consultation." : "Renseignez le dossier clinique du patient."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Patient *</Label>
                  <PatientSelect patients={patients} value={formData.patientId} onValueChange={(v) => handleChange("patientId", v)} />
                </div>
                <div className="space-y-2">
                  <Label>Médecin *</Label>
                  <Select value={formData.doctorId} onValueChange={(v) => handleChange("doctorId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          Dr. {d.firstName} {d.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation-plainte">Plainte</Label>
                <Textarea
                  id="consultation-plainte"
                  value={formData.plainte}
                  onChange={(e) => handleChange("plainte", e.target.value)}
                  placeholder="Motif de la consultation"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation-histoire">Histoire de la maladie</Label>
                <Textarea
                  id="consultation-histoire"
                  value={formData.histoireMaladie}
                  onChange={(e) => handleChange("histoireMaladie", e.target.value)}
                  placeholder="Début des symptômes, évolution..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation-antecedent">Antécédent</Label>
                <Textarea
                  id="consultation-antecedent"
                  value={formData.antecedent}
                  onChange={(e) => handleChange("antecedent", e.target.value)}
                  placeholder="Diabète, hypertension, chirurgie..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation-anamnese">Complement Anamnèse</Label>
                <Textarea
                  id="consultation-anamnese"
                  value={formData.comportementAnamnese}
                  onChange={(e) => handleChange("comportementAnamnese", e.target.value)}
                  placeholder="Habitudes, mode de vie, contexte..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation-examen">Examen physique</Label>
                <Textarea
                  id="consultation-examen"
                  value={formData.examenPhysique}
                  onChange={(e) => handleChange("examenPhysique", e.target.value)}
                  placeholder="Constantes, examen clinique..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation-conclusion">Conclusion</Label>
                <Textarea
                  id="consultation-conclusion"
                  value={formData.conclusion}
                  onChange={(e) => handleChange("conclusion", e.target.value)}
                  placeholder="Synthèse et conduite à tenir..."
                  rows={3}
                />
              </div>

              
              <div className="space-y-2">
                <Label htmlFor="consultation-exam-search">Recommandation des examens</Label>
                <Input
                  id="consultation-exam-search"
                  value={examQuery}
                  onChange={(event) => setExamQuery(event.target.value)}
                  placeholder="Rechercher un examen..."
                />
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                  {visibleExams.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      {examCatalog.length === 0 ? "Aucun examen dans la liste." : "Aucun examen ne correspond à cette recherche."}
                    </p>
                  ) : visibleExams.map((item) => (
                    <label key={`${item.kind}-${item.id}`} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                      <Checkbox
                        checked={formData.recommandationExamens.includes(item.id)}
                        onCheckedChange={(checked) => {
                          setFormData((current) => ({
                            ...current,
                            recommandationExamens: checked
                              ? [...current.recommandationExamens, item.id]
                              : current.recommandationExamens.filter((id) => id !== item.id),
                          }));
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block">{item.name}</span>
                        {item.categoryName && <span className="text-xs text-muted-foreground">{item.categoryName}</span>}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.recommandationExamens.length === 0
                    ? "Cochez les examens à recommander."
                    : `${formData.recommandationExamens.length} examen(s) sélectionné(s).`}
                </p>
              </div>

              <OrdonnanceEditor
                lines={formLines}
                recommendations={formRecommendations}
                sheet={sheetFor(formData.patientId, formData.doctorId)}
                onLines={setFormLines}
                onRecommendations={setFormRecommendations}
              />

              <div className="space-y-2">
                <Label>Date de suivi</Label>
                <Input 
                  type="date"
                  value={formData.followUpDate}
                  onChange={(e) => handleChange("followUpDate", e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={closeForm}>
                  Annuler
                </Button>
                <Button variant="hero" className="flex-1" onClick={handleSubmit}>
                  {editingId ? "Enregistrer les modifications" : "Enregistrer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        {[
          { label: "Total", full: "Total consultations", value: consultations.length, icon: Stethoscope, card: "border-primary/25 bg-primary/10", tile: "bg-primary text-primary-foreground", number: "text-primary" },
          { label: "En cours", full: "En cours", value: consultations.filter((item) => item.status === "in_progress").length, icon: Clock, card: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40", tile: "bg-amber-500 text-amber-950", number: "text-amber-800 dark:text-amber-200" },
          { label: "Terminées", full: "Terminées", value: consultations.filter((item) => item.status === "completed").length, icon: CheckCircle, card: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50", tile: "bg-emerald-600 text-white", number: "text-emerald-800 dark:text-emerald-200" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 sm:gap-3 sm:rounded-2xl sm:p-4 ${stat.card}`}>
              <div className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:flex ${stat.tile}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium leading-tight text-foreground/80 sm:text-sm sm:leading-snug">
                  <span className="sm:hidden">{stat.label}</span>
                  <span className="hidden sm:inline">{stat.full}</span>
                </p>
                <p className={`text-lg font-bold tabular-nums leading-none sm:text-3xl ${stat.number}`}>{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <Input
            placeholder="Rechercher par patient, médecin ou plainte..."
            className="h-9 rounded-xl border-primary/20 bg-card pl-10 shadow-sm md:h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-9 shrink-0 rounded-xl px-3 md:h-11">
          <Filter className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Filtres</span>
        </Button>
      </div>
      </div>

      {/* Consultations list */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredConsultations.length === 0 && (
          <p className="col-span-full py-8 text-center text-muted-foreground">Aucune consultation enregistrée.</p>
        )}
        {filteredConsultations.map((consultation) => {
          const StatusIcon = statusConfig[consultation.status].icon;
          return (
            <Card
              key={consultation.id}
              className="cursor-pointer p-4 transition-colors hover:bg-muted/40"
              onClick={() => openDetail(consultation)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{consultation.patientName}</h3>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{consultation.plainte || "Consultation"}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={(event) => event.stopPropagation()}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenuItem onClick={() => openDetail(consultation)}>
                      Voir les détails
                    </DropdownMenuItem>
                    {canWrite && (
                      <DropdownMenuItem onClick={() => openEdit(consultation)}>
                        Modifier
                      </DropdownMenuItem>
                    )}
                    {canWrite && consultation.status === "in_progress" && (
                      <DropdownMenuItem onClick={() => handleComplete(consultation.id)}>
                        Marquer comme terminée
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem className="text-destructive" onClick={() => setPendingDelete(consultation)}>
                        Supprimer
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1 truncate">
                    <User className="h-3 w-3 shrink-0" />
                    {consultation.doctorName}
                  </p>
                  <p className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 shrink-0" />
                    {consultation.date}
                  </p>
                </div>
                <Badge variant="outline" className={statusConfig[consultation.status].color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig[consultation.status].label}
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedConsultation} onOpenChange={(open) => { if (!open) setSelectedConsultation(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedConsultation?.patientName || "Consultation"}</DialogTitle>
            <DialogDescription>Dossier de la consultation.</DialogDescription>
          </DialogHeader>
          {selectedConsultation && (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{selectedConsultation.patientName}</span>
                <span>{selectedConsultation.doctorName}</span>
                <span>{selectedConsultation.date}</span>
                <span>{statusConfig[selectedConsultation.status].label}</span>
              </div>
              {([
                ["Plainte", selectedConsultation.plainte],
                ["Histoire de la maladie", selectedConsultation.histoireMaladie],
                ["Antécédent", selectedConsultation.antecedent],
                ["Complement Anamnèse", selectedConsultation.comportementAnamnese],
                ["Examen physique", selectedConsultation.examenPhysique],
                ["Conclusion", selectedConsultation.conclusion],
                ["Recommandation des examens", selectedConsultation.recommandationExamens],
              ] as const).filter(([, value]) => value).map(([label, value]) => (
                <div key={label} className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="whitespace-pre-wrap text-sm">{value}</p>
                </div>
              ))}
              {(detailLines.some((line) => line.medication.trim()) || detailNotes.trim()) && (
                <OrdonnanceEditor
                  readOnly
                  lines={detailLines}
                  recommendations={detailNotes}
                  sheet={sheetFor(selectedConsultation.patientId, selectedConsultation.doctorId, selectedConsultation.date)}
                  onLines={setDetailLines}
                  onRecommendations={setDetailNotes}
                />
              )}
              {selectedConsultation.allergies && selectedConsultation.allergies.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Allergies</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedConsultation.allergies.map((allergy) => (
                      <Badge key={allergy} variant="destructive" className="text-xs">{allergy}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedConsultation.followUpDate && (
                <p className="text-sm text-muted-foreground">Suivi prévu le {selectedConsultation.followUpDate}</p>
              )}
              {canWrite && (
                <Button variant="outline" onClick={() => { const current = selectedConsultation; setSelectedConsultation(null); openEdit(current); }}>
                  Modifier
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette consultation ?</AlertDialogTitle>
            <AlertDialogDescription>
              La consultation de {pendingDelete?.patientName} sera retirée du dossier. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
