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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { consultationService } from "@/services/consultationService";
import { examService, type ExamCatalogItem } from "@/services/examService";
import { patientService } from "@/services/patientService";
import { personnelService } from "@/services/personnelService";
import type { Consultation, Patient, Personnel } from "@/types";
import { apiMessage } from "@/lib/apiError";

const statusConfig = {
  in_progress: { label: "En cours", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  completed: { label: "Terminée", color: "bg-success/10 text-success border-success/20", icon: CheckCircle }
};

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
  const [pendingDelete, setPendingDelete] = useState<Consultation | null>(null);
  
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
    prescription: "",
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
  };

  const openCreate = () => {
    setEditingId(null);
    setExamQuery("");
    setFormData(emptyForm);
    setIsDialogOpen(true);
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
      prescription: consultation.prescription ?? "",
      followUpDate: consultation.followUpDate ?? "",
    });
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
      prescription: formData.prescription.trim(),
      followUpDate: formData.followUpDate,
    };

    try {
      if (editingId) {
        await consultationService.update(editingId, {
          patientId: formData.patientId,
          doctorId: formData.doctorId,
          ...clinical,
        });
        toast({ title: "Consultation modifiée", description: "Les modifications ont été enregistrées." });
      } else {
        await consultationService.create({
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
        toast({ title: "Consultation créée", description: "La consultation a été enregistrée avec succès" });
      }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Consultation</h1>
          <p className="mt-1 text-muted-foreground">
            Gestion des consultations et diagnostics
          </p>
        </div>
        {canWrite && (
          <Button variant="hero" size="lg" onClick={openCreate}>
            <Plus className="h-5 w-5 mr-2" />
            Nouvelle consultation
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
                  <Select value={formData.patientId} onValueChange={(v) => handleChange("patientId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              <div className="space-y-2">
                <Label>Prescription</Label>
                <Textarea 
                  value={formData.prescription}
                  onChange={(e) => handleChange("prescription", e.target.value)}
                  placeholder="Médicaments prescrits..."
                  rows={2}
                />
              </div>

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
      <div className="grid gap-4 sm:grid-cols-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <div className="rounded-lg bg-card border border-border p-4">
          <p className="text-sm text-muted-foreground">Total consultations</p>
          <p className="text-2xl font-bold">{consultations.length}</p>
        </div>
        <div className="rounded-lg bg-warning/10 border border-warning/20 p-4">
          <p className="text-sm text-warning">En cours</p>
          <p className="text-2xl font-bold text-warning">{consultations.filter(c => c.status === "in_progress").length}</p>
        </div>
        <div className="rounded-lg bg-success/10 border border-success/20 p-4">
          <p className="text-sm text-success">Terminées</p>
          <p className="text-2xl font-bold text-success">{consultations.filter(c => c.status === "completed").length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-4 sm:flex-row animate-slide-up" style={{ animationDelay: "150ms" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Rechercher par patient, médecin ou plainte..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filtres
        </Button>
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
              onClick={() => setSelectedConsultation(consultation)}
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
                    <DropdownMenuItem onClick={() => setSelectedConsultation(consultation)}>
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
                ["Prescription", selectedConsultation.prescription],
              ] as const).filter(([, value]) => value).map(([label, value]) => (
                <div key={label} className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="whitespace-pre-wrap text-sm">{value}</p>
                </div>
              ))}
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
