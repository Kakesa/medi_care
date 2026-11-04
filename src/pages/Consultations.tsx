import { useEffect, useState } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Stethoscope,
  User,
  Calendar,
  FileText,
  Clock,
  CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Personnel[]>([]);
  const [examCatalog, setExamCatalog] = useState<ExamCatalogItem[]>([]);
  const [examQuery, setExamQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  
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

  const handleSubmit = async () => {
    if (!formData.patientId || !formData.doctorId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez sélectionner un patient et un médecin",
      });
      return;
    }

    try {
      await consultationService.create({
        patientId: formData.patientId,
        patientName: "",
        doctorId: formData.doctorId,
        doctorName: "",
        diagnosis: "",
        symptoms: [],
        allergies: formData.allergies.split(",").map((item) => item.trim()).filter(Boolean),
        plainte: formData.plainte.trim() || undefined,
        histoireMaladie: formData.histoireMaladie.trim() || undefined,
        antecedent: formData.antecedent.trim() || undefined,
        comportementAnamnese: formData.comportementAnamnese.trim() || undefined,
        examenPhysique: formData.examenPhysique.trim() || undefined,
        conclusion: formData.conclusion.trim() || undefined,
        recommandationExamens: examCatalog
          .filter((item) => formData.recommandationExamens.includes(item.id))
          .map((item) => item.name)
          .join("\n") || undefined,
        treatment: "",
        prescription: formData.prescription || undefined,
        followUpDate: formData.followUpDate || undefined,
      });
      setIsDialogOpen(false);
      setExamQuery("");
      setFormData(emptyForm);
      toast({
        title: "Consultation créée",
        description: "La consultation a été enregistrée avec succès",
      });
      await loadConsultations();
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await consultationService.complete(id);
      toast({
        title: "Consultation terminée",
        description: "La consultation a été marquée comme terminée",
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Nouvelle consultation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle consultation</DialogTitle>
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
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation-antecedent">Antécédent</Label>
                <Textarea
                  id="consultation-antecedent"
                  value={formData.antecedent}
                  onChange={(e) => handleChange("antecedent", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation-anamnese">Comportement Anamnèse</Label>
                <Textarea
                  id="consultation-anamnese"
                  value={formData.comportementAnamnese}
                  onChange={(e) => handleChange("comportementAnamnese", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation-examen">Examen physique</Label>
                <Textarea
                  id="consultation-examen"
                  value={formData.examenPhysique}
                  onChange={(e) => handleChange("examenPhysique", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation-conclusion">Conclusion</Label>
                <Textarea
                  id="consultation-conclusion"
                  value={formData.conclusion}
                  onChange={(e) => handleChange("conclusion", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation-allergies">Allergies (séparées par virgule)</Label>
                <Textarea
                  id="consultation-allergies"
                  value={formData.allergies}
                  onChange={(e) => handleChange("allergies", e.target.value)}
                  placeholder="Pénicilline, Aspirine..."
                  rows={2}
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
                <Button variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button variant="hero" className="flex-1" onClick={handleSubmit}>
                  Enregistrer
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
      <div className="space-y-4">
        {filteredConsultations.map((consultation, index) => {
          const StatusIcon = statusConfig[consultation.status].icon;
          return (
            <Card 
              key={consultation.id}
              className="p-4 animate-slide-up sm:p-6"
              style={{ animationDelay: `${200 + index * 50}ms` }}
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Stethoscope className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{consultation.plainte || "Consultation"}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {consultation.patientName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Stethoscope className="h-4 w-4" />
                        {consultation.doctorName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {consultation.date}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={statusConfig[consultation.status].color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig[consultation.status].label}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Voir les détails</DropdownMenuItem>
                      <DropdownMenuItem>Modifier</DropdownMenuItem>
                      {consultation.status === "in_progress" && (
                        <DropdownMenuItem onClick={() => handleComplete(consultation.id)}>
                          Marquer comme terminée
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem>Imprimer</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {([
                ["Plainte", consultation.plainte],
                ["Histoire de la maladie", consultation.histoireMaladie],
                ["Antécédent", consultation.antecedent],
                ["Comportement Anamnèse", consultation.comportementAnamnese],
                ["Examen physique", consultation.examenPhysique],
                ["Conclusion", consultation.conclusion],
              ] as const).some(([, value]) => value) && (
                <div className="mb-4 space-y-3">
                  {([
                    ["Plainte", consultation.plainte],
                    ["Histoire de la maladie", consultation.histoireMaladie],
                    ["Antécédent", consultation.antecedent],
                    ["Comportement Anamnèse", consultation.comportementAnamnese],
                    ["Examen physique", consultation.examenPhysique],
                    ["Conclusion", consultation.conclusion],
                  ] as const).filter(([, value]) => value).map(([label, value]) => (
                    <div key={label} className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="whitespace-pre-wrap text-sm">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {consultation.allergies && consultation.allergies.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Allergies</p>
                    <div className="flex flex-wrap gap-1">
                      {consultation.allergies.map((allergy, i) => (
                        <Badge key={i} variant="destructive" className="text-xs">{allergy}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {consultation.recommandationExamens && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Recommandation des examens
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{consultation.recommandationExamens}</p>
                  </div>
                )}
                {consultation.prescription && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Prescription
                    </p>
                    <p className="text-sm">{consultation.prescription}</p>
                  </div>
                )}
              </div>

              {consultation.followUpDate && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Suivi prévu le {consultation.followUpDate}
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
