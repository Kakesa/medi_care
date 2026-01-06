import { useState } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Stethoscope,
  User,
  Calendar,
  FileText,
  Pill,
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
import { mockConsultations, mockPatients, availableDoctors, Consultation } from "@/data/mockData";

const statusConfig = {
  in_progress: { label: "En cours", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  completed: { label: "Terminée", color: "bg-success/10 text-success border-success/20", icon: CheckCircle }
};

export default function Consultations() {
  const { toast } = useToast();
  const [consultations, setConsultations] = useState<Consultation[]>(mockConsultations);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  
  const [formData, setFormData] = useState({
    patientId: "",
    doctorId: "",
    diagnosis: "",
    symptoms: "",
    treatment: "",
    prescription: "",
    notes: "",
    followUpDate: ""
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const patient = mockPatients.find(p => p.id === formData.patientId);
    const doctor = availableDoctors.find(d => d.id === formData.doctorId);
    
    if (!patient || !doctor) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez sélectionner un patient et un médecin",
      });
      return;
    }

    const newConsultation: Consultation = {
      id: `cons-${Date.now()}`,
      patientId: formData.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorId: formData.doctorId,
      doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
      date: new Date().toISOString().split('T')[0],
      diagnosis: formData.diagnosis,
      symptoms: formData.symptoms.split(',').map(s => s.trim()),
      treatment: formData.treatment,
      prescription: formData.prescription,
      notes: formData.notes,
      followUpDate: formData.followUpDate || undefined,
      status: "in_progress"
    };

    setConsultations(prev => [newConsultation, ...prev]);
    setIsDialogOpen(false);
    setFormData({
      patientId: "",
      doctorId: "",
      diagnosis: "",
      symptoms: "",
      treatment: "",
      prescription: "",
      notes: "",
      followUpDate: ""
    });

    toast({
      title: "Consultation créée",
      description: "La consultation a été enregistrée avec succès",
    });
  };

  const handleComplete = (id: string) => {
    setConsultations(prev => 
      prev.map(c => c.id === id ? { ...c, status: "completed" as const } : c)
    );
    toast({
      title: "Consultation terminée",
      description: "La consultation a été marquée comme terminée",
    });
  };

  const filteredConsultations = consultations.filter(c =>
    c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.diagnosis.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Consultations</h1>
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
                      {mockPatients.map(p => (
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
                      {availableDoctors.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          Dr. {d.firstName} {d.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Symptômes (séparés par virgule)</Label>
                <Input 
                  value={formData.symptoms}
                  onChange={(e) => handleChange("symptoms", e.target.value)}
                  placeholder="Fièvre, toux, fatigue..."
                />
              </div>

              <div className="space-y-2">
                <Label>Diagnostic *</Label>
                <Input 
                  value={formData.diagnosis}
                  onChange={(e) => handleChange("diagnosis", e.target.value)}
                  placeholder="Diagnostic médical"
                />
              </div>

              <div className="space-y-2">
                <Label>Traitement *</Label>
                <Textarea 
                  value={formData.treatment}
                  onChange={(e) => handleChange("treatment", e.target.value)}
                  placeholder="Description du traitement"
                  rows={2}
                />
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
                <Label>Notes additionnelles</Label>
                <Textarea 
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Notes pour le dossier..."
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
            placeholder="Rechercher par patient, médecin, diagnostic..."
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
              className="p-6 animate-slide-up"
              style={{ animationDelay: `${200 + index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Stethoscope className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{consultation.diagnosis}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
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

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Symptômes</p>
                  <div className="flex flex-wrap gap-1">
                    {consultation.symptoms.map((symptom, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{symptom}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Pill className="h-3 w-3" />
                    Traitement
                  </p>
                  <p className="text-sm">{consultation.treatment}</p>
                </div>
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
