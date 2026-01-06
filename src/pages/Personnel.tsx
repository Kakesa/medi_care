import { useState } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle, 
  XCircle, 
  Clock,
  Mail,
  Phone,
  Building,
  Edit,
  Trash2,
  Eye
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import { mockPersonnel, type Personnel, departments, roleLabels } from "@/data/mockData";

const statusConfig = {
  active: { label: "Actif", color: "bg-success/10 text-success border-success/20", icon: CheckCircle },
  pending: { label: "En attente", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  inactive: { label: "Inactif", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle }
};

export default function Personnel() {
  const { toast } = useToast();
  const [personnel, setPersonnel] = useState<Personnel[]>(mockPersonnel);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "doctor" as Personnel["role"],
    department: "",
    speciality: "",
    status: "pending" as Personnel["status"]
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
      role: "doctor",
      department: "",
      speciality: "",
      status: "pending"
    });
    setIsEditing(false);
    setSelectedPerson(null);
  };

  const handleEdit = (person: Personnel) => {
    setSelectedPerson(person);
    setFormData({
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: person.phone,
      role: person.role,
      department: person.department,
      speciality: person.speciality || "",
      status: person.status
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

    if (isEditing && selectedPerson) {
      // Update
      setPersonnel(prev => 
        prev.map(p => p.id === selectedPerson.id ? {
          ...p,
          ...formData,
          avatar: formData.firstName[0] + formData.lastName[0]
        } : p)
      );
      toast({
        title: "Personnel modifié",
        description: `${formData.firstName} ${formData.lastName} a été mis à jour`,
      });
    } else {
      // Create
      const newPerson: Personnel = {
        id: `pers-${Date.now()}`,
        ...formData,
        hireDate: new Date().toISOString().split('T')[0],
        avatar: formData.firstName[0] + formData.lastName[0]
      };
      setPersonnel(prev => [newPerson, ...prev]);
      toast({
        title: "Personnel ajouté",
        description: `${formData.firstName} ${formData.lastName} a été ajouté`,
      });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = () => {
    if (selectedPerson) {
      setPersonnel(prev => prev.filter(p => p.id !== selectedPerson.id));
      toast({
        title: "Personnel supprimé",
        description: `${selectedPerson.firstName} ${selectedPerson.lastName} a été supprimé`,
      });
    }
    setIsDeleteDialogOpen(false);
    setSelectedPerson(null);
  };

  const handleStatusChange = (id: string, status: Personnel["status"]) => {
    setPersonnel(prev => 
      prev.map(p => p.id === id ? { ...p, status } : p)
    );
    toast({
      title: "Statut mis à jour",
      description: status === "active" ? "Le membre a été activé" : "Le statut a été modifié",
    });
  };

  const filteredPersonnel = personnel.filter(person =>
    person.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    person.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    person.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    person.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion du Personnel</h1>
          <p className="mt-1 text-muted-foreground">
            Gérez les médecins, infirmiers et personnel administratif
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="hero" size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Ajouter un membre
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Modifier le membre" : "Ajouter un membre"}</DialogTitle>
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

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="jean.dupont@medicare.fr"
                />
              </div>

              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input 
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="06 XX XX XX XX"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rôle *</Label>
                  <Select value={formData.role} onValueChange={(v) => handleChange("role", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">Médecin</SelectItem>
                      <SelectItem value="nurse">Infirmier(ère)</SelectItem>
                      <SelectItem value="secretary">Secrétaire</SelectItem>
                      <SelectItem value="admin">Administrateur</SelectItem>
                      <SelectItem value="receptionist">Réceptionniste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Département *</Label>
                  <Select value={formData.department} onValueChange={(v) => handleChange("department", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.role === "doctor" && (
                <div className="space-y-2">
                  <Label>Spécialité</Label>
                  <Input 
                    value={formData.speciality}
                    onChange={(e) => handleChange("speciality", e.target.value)}
                    placeholder="Cardiologue, Neurologue..."
                  />
                </div>
              )}

              {isEditing && (
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}>
                  Annuler
                </Button>
                <Button variant="hero" className="flex-1" onClick={handleSubmit}>
                  {isEditing ? "Enregistrer" : "Ajouter"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row animate-slide-up" style={{ animationDelay: "100ms" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Rechercher par nom, email, département..."
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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 animate-slide-up" style={{ animationDelay: "150ms" }}>
        <div className="rounded-lg bg-success/10 border border-success/20 p-4">
          <p className="text-sm text-success">Personnel actif</p>
          <p className="text-2xl font-bold text-success">{personnel.filter(p => p.status === "active").length}</p>
        </div>
        <div className="rounded-lg bg-warning/10 border border-warning/20 p-4">
          <p className="text-sm text-warning">En attente d'approbation</p>
          <p className="text-2xl font-bold text-warning">{personnel.filter(p => p.status === "pending").length}</p>
        </div>
        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-foreground">{personnel.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden animate-slide-up" style={{ animationDelay: "200ms" }}>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead>Membre</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Département</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPersonnel.map((person, index) => {
              const StatusIcon = statusConfig[person.status].icon;
              return (
                <TableRow 
                  key={person.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${250 + index * 50}ms` }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                        {person.avatar}
                      </div>
                      <div>
                        <p className="font-medium">{person.firstName} {person.lastName}</p>
                        <p className="text-sm text-muted-foreground">
                          {roleLabels[person.role]}
                          {person.speciality && ` - ${person.speciality}`}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {person.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {person.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {person.department}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusConfig[person.status].color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig[person.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(person)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        {person.status === "pending" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(person.id, "active")}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approuver
                          </DropdownMenuItem>
                        )}
                        {person.status === "active" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(person.id, "inactive")}>
                            <XCircle className="h-4 w-4 mr-2" />
                            Désactiver
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            setSelectedPerson(person);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedPerson?.firstName} {selectedPerson?.lastName} ? 
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
