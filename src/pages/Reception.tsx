import { useEffect, useState } from "react";
import { 
  Plus, 
  Search, 
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  Stethoscope,
  XCircle,
  UserPlus,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { receptionService } from "@/services/receptionService";
import { patientService } from "@/services/patientService";
import { personnelService } from "@/services/personnelService";
import type { Patient, Personnel, Reception } from "@/types";
import { apiMessage } from "@/lib/apiError";

const priorityConfig = {
  low: { label: "Faible", color: "bg-info/10 text-info border-info/20" },
  medium: { label: "Moyen", color: "bg-warning/10 text-warning border-warning/20" },
  high: { label: "Élevé", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  urgent: { label: "Urgent", color: "bg-destructive/10 text-destructive border-destructive/20" }
};

const statusConfig = {
  waiting: { label: "En attente", color: "bg-muted text-muted-foreground", icon: Clock },
  in_consultation: { label: "En consultation", color: "bg-primary/10 text-primary", icon: Stethoscope },
  completed: { label: "Terminé", color: "bg-success/10 text-success", icon: CheckCircle },
  cancelled: { label: "Annulé", color: "bg-destructive/10 text-destructive", icon: XCircle }
};

export default function ReceptionPage() {
  const { toast } = useToast();
  const [receptionList, setReceptionList] = useState<Reception[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Personnel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    patientId: "",
    patientName: "",
    reason: "",
    priority: "low" as "low" | "medium" | "high" | "urgent",
    notes: "",
    isNewPatient: false,
    dateOfBirth: "",
    gender: "M" as "M" | "F"
  });

  const loadReception = async () => {
    try {
      const [queue, patientResult, doctorResult] = await Promise.all([
        receptionService.getQueue({ limit: 100 }),
        patientService.getAll({ limit: 100 }),
        personnelService.getDoctors(),
      ]);
      setReceptionList(queue.data);
      setPatients(patientResult.data);
      setDoctors(doctorResult);
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  useEffect(() => {
    void loadReception();
  }, []);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.reason || (formData.isNewPatient ? !formData.patientName : !formData.patientId)) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
      });
      return;
    }
    if (formData.isNewPatient && !formData.dateOfBirth) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "La date de naissance est requise pour un nouveau patient",
      });
      return;
    }

    try {
      let patientId = formData.patientId;
      if (formData.isNewPatient) {
        const [firstName, ...rest] = formData.patientName.trim().split(/\s+/);
        const created = await patientService.create({
          firstName: firstName || formData.patientName,
          lastName: rest.join(" ") || firstName || "Inconnu",
          email: `accueil-${Date.now()}@patient.local`,
          phone: "",
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          address: "",
        });
        patientId = created.id;
      }

      await receptionService.registerArrival({
        patientId,
        patientName: "",
        reason: formData.reason,
        priority: formData.priority,
        notes: formData.notes || undefined,
      });
      setIsDialogOpen(false);
      setFormData({
        patientId: "",
        patientName: "",
        reason: "",
        priority: "low",
        notes: "",
        isNewPatient: false,
        dateOfBirth: "",
        gender: "M"
      });
      toast({
        title: "Patient enregistré",
        description: "Le patient a été ajouté à la file d'attente",
      });
      await loadReception();
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  const handleStatusChange = async (id: string, newStatus: Reception["status"], doctorId?: string) => {
    try {
      if (newStatus === "in_consultation" && doctorId) {
        await receptionService.assignDoctor(id, doctorId);
      } else {
        await receptionService.updateStatus(id, newStatus);
      }
      toast({
        title: "Statut mis à jour",
        description: `Le patient a été ${newStatus === "in_consultation" ? "pris en charge" : newStatus === "completed" ? "libéré" : "mis à jour"}`,
      });
      await loadReception();
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  const filteredList = receptionList.filter(r =>
    r.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const waitingCount = receptionList.filter(r => r.status === "waiting").length;
  const inConsultationCount = receptionList.filter(r => r.status === "in_consultation").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Réception</h1>
          <p className="mt-1 text-muted-foreground">
            Accueil et gestion de la file d'attente
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="lg">
              <UserPlus className="h-5 w-5 mr-2" />
              Enregistrer un patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Enregistrer un patient</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant={!formData.isNewPatient ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleChange("isNewPatient", false)}
                >
                  Patient existant
                </Button>
                <Button 
                  variant={formData.isNewPatient ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleChange("isNewPatient", true)}
                >
                  Nouveau patient
                </Button>
              </div>

              {formData.isNewPatient ? (
                <>
                <div className="space-y-2">
                  <Label>Nom du patient *</Label>
                  <Input 
                    value={formData.patientName}
                    onChange={(e) => handleChange("patientName", e.target.value)}
                    placeholder="Prénom Nom"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date de naissance *</Label>
                    <Input type="date" value={formData.dateOfBirth} onChange={(e) => handleChange("dateOfBirth", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sexe *</Label>
                    <Select value={formData.gender} onValueChange={(v) => handleChange("gender", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculin</SelectItem>
                        <SelectItem value="F">Féminin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Sélectionner un patient *</Label>
                  <Select value={formData.patientId} onValueChange={(v) => handleChange("patientId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Rechercher un patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} - {p.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Motif de visite *</Label>
                <Select value={formData.reason} onValueChange={(v) => handleChange("reason", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consultation générale">Consultation générale</SelectItem>
                    <SelectItem value="Urgence">Urgence</SelectItem>
                    <SelectItem value="Suivi médical">Suivi médical</SelectItem>
                    <SelectItem value="Retrait résultats">Retrait résultats</SelectItem>
                    <SelectItem value="Vaccination">Vaccination</SelectItem>
                    <SelectItem value="Certificat médical">Certificat médical</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priorité *</Label>
                <Select value={formData.priority} onValueChange={(v) => handleChange("priority", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Faible - Visite de routine</SelectItem>
                    <SelectItem value="medium">Moyen - Symptômes modérés</SelectItem>
                    <SelectItem value="high">Élevé - Symptômes importants</SelectItem>
                    <SelectItem value="urgent">Urgent - Nécessite attention immédiate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Informations complémentaires..."
                  rows={3}
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
      <div className="grid grid-cols-2 gap-4 animate-slide-up lg:grid-cols-4" style={{ animationDelay: "100ms" }}>
        <div className="rounded-lg bg-card border border-border p-4">
          <p className="text-sm text-muted-foreground">Aujourd'hui</p>
          <p className="text-2xl font-bold">{receptionList.length}</p>
        </div>
        <div className="rounded-lg bg-warning/10 border border-warning/20 p-4">
          <p className="text-sm text-warning flex items-center gap-1">
            <Clock className="h-4 w-4" />
            En attente
          </p>
          <p className="text-2xl font-bold text-warning">{waitingCount}</p>
        </div>
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
          <p className="text-sm text-primary flex items-center gap-1">
            <Stethoscope className="h-4 w-4" />
            En consultation
          </p>
          <p className="text-2xl font-bold text-primary">{inConsultationCount}</p>
        </div>
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Urgents
          </p>
          <p className="text-2xl font-bold text-destructive">
            {receptionList.filter(r => r.priority === "urgent" && r.status === "waiting").length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4 animate-slide-up" style={{ animationDelay: "150ms" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Rechercher un patient..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Queue list */}
      <div className="space-y-3">
        {filteredList
          .sort((a, b) => {
            // Sort by priority (urgent first), then by arrival time
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
            if (a.status === "waiting" && b.status !== "waiting") return -1;
            if (a.status !== "waiting" && b.status === "waiting") return 1;
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          })
          .map((entry, index) => {
            const StatusIcon = statusConfig[entry.status].icon;
            return (
              <Card 
                key={entry.id}
                className={`p-4 animate-slide-up ${entry.priority === "urgent" && entry.status === "waiting" ? "border-destructive/50 bg-destructive/5" : ""}`}
                style={{ animationDelay: `${200 + index * 30}ms` }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-bold">{entry.arrivalTime}</p>
                      <p className="text-xs text-muted-foreground">Arrivée</p>
                    </div>
                    
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{entry.patientName}</h3>
                        {!entry.patientId && (
                          <Badge variant="outline" className="text-xs">Nouveau</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{entry.reason}</p>
                      {entry.assignedDoctor && (
                        <p className="text-sm text-primary flex items-center gap-1 mt-1">
                          <Stethoscope className="h-3 w-3" />
                          {entry.assignedDoctor}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={priorityConfig[entry.priority].color}>
                      {entry.priority === "urgent" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {priorityConfig[entry.priority].label}
                    </Badge>
                    <Badge variant="outline" className={statusConfig[entry.status].color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig[entry.status].label}
                    </Badge>

                    {entry.status === "waiting" && (
                      <Select onValueChange={(doctorId) => {
                        handleStatusChange(entry.id, "in_consultation", doctorId);
                      }}>
                        <SelectTrigger className="w-auto">
                          <Button variant="outline" size="sm" asChild>
                            <span>
                              Prendre en charge
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </span>
                          </Button>
                        </SelectTrigger>
                        <SelectContent>
                          {doctors.map(d => (
                            <SelectItem key={d.id} value={d.id}>
                              Dr. {d.firstName} {d.lastName} - {d.department}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {entry.status === "in_consultation" && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleStatusChange(entry.id, "completed")}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Terminer
                      </Button>
                    )}
                  </div>
                </div>

                {entry.notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Notes:</span> {entry.notes}
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
