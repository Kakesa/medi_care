import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  FileText,
  Calendar,
  User,
  Users,
  BedDouble,
  UserRound,
  CheckCircle2,
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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { patientService } from "@/services/patientService";
import type { Patient } from "@/types";
import { apiMessage } from "@/lib/apiError";

const statusConfig = {
  hospitalized: { label: "Hospitalisé", color: "bg-warning/10 text-warning border-warning/20" },
  outpatient: { label: "Ambulatoire", color: "bg-info/10 text-info border-info/20" },
  discharged: { label: "Sorti", color: "bg-success/10 text-success border-success/20" }
};

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function Patients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canCreatePatient = user?.role !== "NURSE";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [totals, setTotals] = useState({ total: 0, hospitalized: 0, outpatient: 0, discharged: 0 });
  const [searchQuery, setSearchQuery] = useState(() => params.get("q") ?? "");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    age: "",
    gender: "M" as "M" | "F",
    address: "",
    bloodType: "",
    temperature: "",
    tension: "",
    saturation: "",
    status: "outpatient" as Patient["status"],
    room: ""
  });

  const loadPatients = async (search = searchQuery) => {
    const term = search.trim();
    try {
      const result = await patientService.getAll({ limit: 100, ...(term ? { search: term } : {}) });
      setPatients(result.data);
      if (!term) {
        setTotals({
          total: result.data.length,
          hospitalized: result.data.filter((patient) => patient.status === "hospitalized").length,
          outpatient: result.data.filter((patient) => patient.status === "outpatient").length,
          discharged: result.data.filter((patient) => patient.status === "discharged").length,
        });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  useEffect(() => {
    setSearchQuery(params.get("q") ?? "");
  }, [params]);

  useEffect(() => {
    let active = true;
    const handle = window.setTimeout(() => {
      void (async () => {
        const term = searchQuery.trim();
        try {
          const result = await patientService.getAll({ limit: 100, ...(term ? { search: term } : {}) });
          if (!active) return;
          setPatients(result.data);
          if (!term) {
            setTotals({
              total: result.data.length,
              hospitalized: result.data.filter((patient) => patient.status === "hospitalized").length,
              outpatient: result.data.filter((patient) => patient.status === "outpatient").length,
              discharged: result.data.filter((patient) => patient.status === "discharged").length,
            });
          }
        } catch (error) {
          if (active) toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
        }
      })();
    }, searchQuery.trim() ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [searchQuery]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      age: "",
      gender: "M",
      address: "",
      bloodType: "",
      temperature: "",
      tension: "",
      saturation: "",
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
      age: patient.dateOfBirth ? String(calculateAge(patient.dateOfBirth)) : "",
      gender: patient.gender,
      address: patient.address,
      bloodType: patient.bloodType || "",
      temperature: patient.temperature != null ? String(patient.temperature) : "",
      tension: patient.tension || "",
      saturation: patient.saturation != null ? String(patient.saturation) : "",
      status: patient.status,
      room: patient.room || ""
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const age = Number(formData.age);
    if (!formData.firstName || !formData.lastName || !formData.email || formData.age.trim() === "") {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir le nom, l'email et l'âge",
      });
      return;
    }
    if (!Number.isInteger(age) || age < 0 || age > 120) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Indiquez l'âge en années, par exemple 20",
      });
      return;
    }

    const temperature = formData.temperature ? Number(formData.temperature) : null;
    const tension = formData.tension.replace(/\s/g, "");
    const saturation = formData.saturation ? Number(formData.saturation) : null;
    if (temperature != null && (Number.isNaN(temperature) || temperature < 30 || temperature > 45)) {
      toast({ variant: "destructive", title: "Erreur", description: "La température doit être entre 30 et 45 °C" });
      return;
    }
    if (tension && !/^\d{2,3}\/\d{2,3}$/.test(tension)) {
      toast({ variant: "destructive", title: "Erreur", description: "Indiquez la tension au format 120/80" });
      return;
    }
    if (saturation != null && (!Number.isInteger(saturation) || saturation < 0 || saturation > 100)) {
      toast({ variant: "destructive", title: "Erreur", description: "La saturation doit être un pourcentage entre 0 et 100" });
      return;
    }

    const patientData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone || undefined,
      dateOfBirth: dateFromAge(age),
      gender: formData.gender,
      address: formData.address || undefined,
      bloodType: formData.bloodType || undefined,
      temperature: formData.temperature ? Number(formData.temperature) : null,
      tension: formData.tension.replace(/\s/g, "") || null,
      saturation: formData.saturation ? Number(formData.saturation) : null,
      status: formData.status,
      room: formData.status === "hospitalized" ? formData.room || undefined : undefined,
    };

    try {
      if (isEditing && selectedPatient) {
        await patientService.update(selectedPatient.id, patientData);
        toast({
          title: "Patient modifié",
          description: `${formData.firstName} ${formData.lastName} a été mis à jour`,
        });
      } else {
        await patientService.create(patientData);
        toast({
          title: "Patient ajouté",
          description: patientData.email
            ? `${formData.firstName} ${formData.lastName} recevra un mot de passe temporaire par e-mail et devra le changer à la première connexion.`
            : `${formData.firstName} ${formData.lastName} a été enregistré`,
        });
      }
      setIsDialogOpen(false);
      resetForm();
      await loadPatients();
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!selectedPatient) return;
    try {
      await patientService.delete(selectedPatient.id);
      toast({
        title: "Dossier archivé",
        description: `${selectedPatient.firstName} ${selectedPatient.lastName} a été archivé`,
      });
      setIsDeleteDialogOpen(false);
      setSelectedPatient(null);
      await loadPatients();
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  const handleDischarge = async (patient: Patient) => {
    try {
      await patientService.update(patient.id, { status: "discharged", room: "" });
      toast({
        title: "Patient libéré",
        description: `${patient.firstName} ${patient.lastName} a été marqué comme sorti`,
      });
      await loadPatients();
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  const dateFromAge = (years: number) => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  };

  const calculateAge = (dateOfBirth: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
    if (!match) return 0;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const today = new Date();
    let age = today.getFullYear() - year;
    if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
      age--;
    }
    return age;
  };

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 mb-4 space-y-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:-mx-6 md:mb-6 md:space-y-4 md:px-6 md:py-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 sm:items-end">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary md:text-sm md:normal-case md:tracking-normal">Dossiers médicaux</p>
          <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground md:text-3xl">Patient</h1>
          <p className="hidden text-muted-foreground md:mt-1 md:block">
            Dossiers médicaux et suivi des patients
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          {canCreatePatient && (
            <DialogTrigger asChild>
              <Button variant="hero" size="sm" className="shrink-0 md:h-11 md:px-5">
                <Plus className="h-4 w-4 md:mr-2 md:h-5 md:w-5" />
                <span className="ml-1 md:ml-0">Nouveau</span>
              </Button>
            </DialogTrigger>
          )}
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
                  <Label htmlFor="patient-age">Âge *</Label>
                  <div className="relative">
                    <Input
                      id="patient-age"
                      type="number"
                      min={0}
                      max={120}
                      step={1}
                      value={formData.age}
                      onChange={(e) => handleChange("age", e.target.value)}
                      placeholder="20"
                      className="pr-12"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">ans</span>
                  </div>
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

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="patient-temperature">Température (°C)</Label>
                  <Input
                    id="patient-temperature"
                    type="number"
                    min={30}
                    max={45}
                    step={0.1}
                    value={formData.temperature}
                    onChange={(e) => handleChange("temperature", e.target.value)}
                    placeholder="36.5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patient-tension">Tension</Label>
                  <Input
                    id="patient-tension"
                    value={formData.tension}
                    onChange={(e) => handleChange("tension", e.target.value)}
                    placeholder="120/80"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patient-saturation">Saturation (%)</Label>
                  <Input
                    id="patient-saturation"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={formData.saturation}
                    onChange={(e) => handleChange("saturation", e.target.value)}
                    placeholder="98"
                  />
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
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
        {[
          { label: "Total", full: "Total patients", value: totals.total, icon: Users, card: "border-primary/25 bg-primary/10", tile: "bg-primary text-primary-foreground", number: "text-primary" },
          { label: "Hospit.", full: "Hospitalisés", value: totals.hospitalized, icon: BedDouble, card: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40", tile: "bg-amber-500 text-amber-950", number: "text-amber-800 dark:text-amber-200" },
          { label: "Ambul.", full: "Ambulatoires", value: totals.outpatient, icon: UserRound, card: "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/50", tile: "bg-sky-600 text-white", number: "text-sky-800 dark:text-sky-200" },
          { label: "Sortis", full: "Sortis (ce mois)", value: totals.discharged, icon: CheckCircle2, card: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50", tile: "bg-emerald-600 text-white", number: "text-emerald-800 dark:text-emerald-200" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.full} className={`flex items-center gap-1.5 rounded-xl border px-1.5 py-1.5 sm:gap-3 sm:rounded-2xl sm:p-4 ${stat.card}`}>
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
            placeholder="Rechercher par nom, téléphone ou email..."
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

      {/* Patient cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {patients.length === 0 && (
          <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            {searchQuery.trim() ? "Aucun patient ne correspond à cette recherche." : "Aucun patient enregistré."}
          </p>
        )}
        {patients.map((patient, index) => (
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
                  {patient.email && <p className="text-sm text-muted-foreground">{patient.email}</p>}
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
                <span>Âge : {calculateAge(patient.dateOfBirth)} ans • {patient.gender === "M" ? "Homme" : "Femme"}</span>
                {patient.bloodType && (
                  <Badge variant="outline" className="ml-auto">{patient.bloodType}</Badge>
                )}
              </div>
              {(patient.temperature != null || patient.tension || patient.saturation != null) && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                  {patient.temperature != null && <span>Température {patient.temperature.toLocaleString("fr-FR")} °C</span>}
                  {patient.tension && <span>Tension {patient.tension}</span>}
                  {patient.saturation != null && <span>Saturation {patient.saturation} %</span>}
                </div>
              )}
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
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate(`/dashboard/patients/${patient.id}`)}>
                <FileText className="h-4 w-4 mr-1" />
                Dossier patient
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
