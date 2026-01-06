import { useState } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  FileText,
  Calendar,
  User,
  Phone,
  MapPin,
  Edit,
  Trash2,
  Stethoscope
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { mockPatients, type Patient } from "@/data/mockData";

const statusConfig = {
  hospitalized: { label: "Hospitalisé", color: "bg-warning/10 text-warning border-warning/20" },
  outpatient: { label: "Ambulatoire", color: "bg-info/10 text-info border-info/20" },
  discharged: { label: "Sorti", color: "bg-success/10 text-success border-success/20" }
};

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function Patients() {
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>(mockPatients);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "M" as "M" | "F",
    address: "",
    bloodType: "",
    allergies: "",
    status: "outpatient" as Patient["status"],
    room: ""
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      gender: "M",
      address: "",
      bloodType: "",
      allergies: "",
      status: "outpatient",
      room: ""
    });
    setIsEditing(false);
    setSelectedPatient(null);
  };

  const handleEdit = (patient: Patient) => {
    setSelectedPatient(patient);
    setFormData({
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email,
      phone: patient.phone,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      address: patient.address,
      bloodType: patient.bloodType || "",
      allergies: patient.allergies?.join(", ") || "",
      status: patient.status,
      room: patient.room || ""
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
      });
      return;
    }

    const patientData = {
      ...formData,
      allergies: formData.allergies ? formData.allergies.split(",").map(a => a.trim()) : undefined,
      bloodType: formData.bloodType || undefined,
      room: formData.status === "hospitalized" ? formData.room : undefined,
      admissionDate: formData.status === "hospitalized" ? new Date().toISOString().split('T')[0] : undefined
    };

    if (isEditing && selectedPatient) {
      setPatients(prev => 
        prev.map(p => p.id === selectedPatient.id ? { ...p, ...patientData } : p)
      );
      toast({
        title: "Patient modifié",
        description: `${formData.firstName} ${formData.lastName} a été mis à jour`,
      });
    } else {
      const newPatient: Patient = {
        id: `pat-${Date.now()}`,
        ...patientData,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setPatients(prev => [newPatient, ...prev]);
      toast({
        title: "Patient ajouté",
        description: `${formData.firstName} ${formData.lastName} a été enregistré`,
      });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = () => {
    if (selectedPatient) {
      setPatients(prev => prev.filter(p => p.id !== selectedPatient.id));
      toast({
        title: "Patient supprimé",
        description: `${selectedPatient.firstName} ${selectedPatient.lastName} a été supprimé`,
      });
    }
    setIsDeleteDialogOpen(false);
    setSelectedPatient(null);
  };

  const handleDischarge = (patient: Patient) => {
    setPatients(prev => 
      prev.map(p => p.id === patient.id ? { 
        ...p, 
        status: "discharged" as const, 
        room: undefined,
        dischargeDate: new Date().toISOString().split('T')[0]
      } : p)
    );
    toast({
      title: "Patient libéré",
      description: `${patient.firstName} ${patient.lastName} a été marqué comme sorti`,
    });
  };

  const filteredPatients = patients.filter(patient =>
    `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des Patients</h1>
          <p className="mt-1 text-muted-foreground">
            Dossiers médicaux et suivi des patients
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="hero" size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Nouveau patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Modifier le patient" : "Nouveau patient"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom *</Label>
                  <Input 
                    value={formData.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    placeholder="Jean"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input 
                    value={formData.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input 
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="jean.dupont@email.fr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone *</Label>
                  <Input 
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="06 XX XX XX XX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date de naissance *</Label>
                  <Input 
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sexe *</Label>
                  <Select value={formData.gender} onValueChange={(v) => handleChange("gender", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Homme</SelectItem>
                      <SelectItem value="F">Femme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Groupe sanguin</Label>
                  <Select value={formData.bloodType} onValueChange={(v) => handleChange("bloodType", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {bloodTypes.map(bt => (
                        <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input 
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="12 Rue de Paris, 75001 Paris"
                />
              </div>

              <div className="space-y-2">
                <Label>Allergies (séparées par virgule)</Label>
                <Textarea 
                  value={formData.allergies}
                  onChange={(e) => handleChange("allergies", e.target.value)}
                  placeholder="Pénicilline, Aspirine..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outpatient">Ambulatoire</SelectItem>
                      <SelectItem value="hospitalized">Hospitalisé</SelectItem>
                      <SelectItem value="discharged">Sorti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.status === "hospitalized" && (
                  <div className="space-y-2">
                    <Label>Chambre</Label>
                    <Input 
                      value={formData.room}
                      onChange={(e) => handleChange("room", e.target.value)}
                      placeholder="A-102"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}>
                  Annuler
                </Button>
                <Button variant="hero" className="flex-1" onClick={handleSubmit}>
                  {isEditing ? "Enregistrer" : "Créer le dossier"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <div className="rounded-lg bg-card border border-border p-4">
          <p className="text-sm text-muted-foreground">Total patients</p>
          <p className="text-2xl font-bold">{patients.length}</p>
        </div>
        <div className="rounded-lg bg-warning/10 border border-warning/20 p-4">
          <p className="text-sm text-warning">Hospitalisés</p>
          <p className="text-2xl font-bold text-warning">{patients.filter(p => p.status === "hospitalized").length}</p>
        </div>
        <div className="rounded-lg bg-info/10 border border-info/20 p-4">
          <p className="text-sm text-info">Ambulatoires</p>
          <p className="text-2xl font-bold text-info">{patients.filter(p => p.status === "outpatient").length}</p>
        </div>
        <div className="rounded-lg bg-success/10 border border-success/20 p-4">
          <p className="text-sm text-success">Sortis (ce mois)</p>
          <p className="text-2xl font-bold text-success">{patients.filter(p => p.status === "discharged").length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row animate-slide-up" style={{ animationDelay: "150ms" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Rechercher par nom, ID, email..."
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

      {/* Patient cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPatients.map((patient, index) => (
          <Card 
            key={patient.id}
            className="p-5 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-slide-up"
            style={{ animationDelay: `${200 + index * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  {patient.firstName[0]}{patient.lastName[0]}
                </div>
                <div>
                  <h3 className="font-semibold">{patient.firstName} {patient.lastName}</h3>
                  <p className="text-sm text-muted-foreground">{patient.id}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(patient)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Stethoscope className="h-4 w-4 mr-2" />
                    Nouvelle consultation
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Calendar className="h-4 w-4 mr-2" />
                    Planifier RDV
                  </DropdownMenuItem>
                  {patient.status === "hospitalized" && (
                    <DropdownMenuItem onClick={() => handleDischarge(patient)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Sortie du patient
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => {
                      setSelectedPatient(patient);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{calculateAge(patient.dateOfBirth)} ans • {patient.gender === "M" ? "Homme" : "Femme"}</span>
                {patient.bloodType && (
                  <Badge variant="outline" className="ml-auto">{patient.bloodType}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{patient.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{patient.address}</span>
              </div>
              {patient.allergies && patient.allergies.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {patient.allergies.map((allergy, i) => (
                    <Badge key={i} variant="destructive" className="text-xs">{allergy}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusConfig[patient.status].color}>
                  {statusConfig[patient.status].label}
                </Badge>
                {patient.room && (
                  <Badge variant="secondary">{patient.room}</Badge>
                )}
              </div>
              <Button variant="ghost" size="sm">
                <FileText className="h-4 w-4 mr-1" />
                Dossier
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le dossier de {selectedPatient?.firstName} {selectedPatient?.lastName} ? 
              Cette action est irréversible.
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
