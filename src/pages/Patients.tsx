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
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";

const patients = [
  {
    id: "P-2024-001",
    name: "Jean Martin",
    age: 45,
    gender: "M",
    phone: "06 12 34 56 78",
    address: "12 Rue de Paris, 75001",
    lastVisit: "15/01/2024",
    condition: "Suivi cardiaque",
    status: "hospitalized",
    room: "A-102"
  },
  {
    id: "P-2024-002",
    name: "Marie Dupont",
    age: 32,
    gender: "F",
    phone: "06 23 45 67 89",
    address: "8 Avenue Victor Hugo, 75016",
    lastVisit: "20/01/2024",
    condition: "Consultation générale",
    status: "outpatient",
    room: null
  },
  {
    id: "P-2024-003",
    name: "Pierre Durand",
    age: 67,
    gender: "M",
    phone: "06 34 56 78 90",
    address: "45 Boulevard Haussmann, 75008",
    lastVisit: "18/01/2024",
    condition: "Diabète type 2",
    status: "hospitalized",
    room: "B-215"
  },
  {
    id: "P-2024-004",
    name: "Sophie Lambert",
    age: 28,
    gender: "F",
    phone: "06 45 67 89 01",
    address: "23 Rue de Rivoli, 75004",
    lastVisit: "22/01/2024",
    condition: "Examen prénatal",
    status: "outpatient",
    room: null
  },
  {
    id: "P-2024-005",
    name: "Michel Bernard",
    age: 55,
    gender: "M",
    phone: "06 56 78 90 12",
    address: "67 Rue du Faubourg, 75010",
    lastVisit: "19/01/2024",
    condition: "Post-opératoire",
    status: "discharged",
    room: null
  },
];

const statusConfig = {
  hospitalized: { label: "Hospitalisé", color: "bg-warning/10 text-warning border-warning/20" },
  outpatient: { label: "Ambulatoire", color: "bg-info/10 text-info border-info/20" },
  discharged: { label: "Sorti", color: "bg-success/10 text-success border-success/20" }
};

export default function Patients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.condition.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <Button variant="hero" size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Nouveau patient
        </Button>
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
            placeholder="Rechercher par nom, ID, condition..."
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
                  {patient.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <h3 className="font-semibold">{patient.name}</h3>
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
                  <DropdownMenuItem>Voir le dossier</DropdownMenuItem>
                  <DropdownMenuItem>Nouvelle consultation</DropdownMenuItem>
                  <DropdownMenuItem>Planifier RDV</DropdownMenuItem>
                  <DropdownMenuItem>Historique</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{patient.age} ans • {patient.gender === "M" ? "Homme" : "Femme"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{patient.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{patient.address}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Dernière visite: {patient.lastVisit}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusConfig[patient.status as keyof typeof statusConfig].color}>
                  {statusConfig[patient.status as keyof typeof statusConfig].label}
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
    </div>
  );
}