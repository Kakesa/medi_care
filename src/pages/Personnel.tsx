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
  Building
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const personnel = [
  {
    id: 1,
    name: "Dr. Sophie Bernard",
    email: "s.bernard@medicare.fr",
    phone: "06 12 34 56 78",
    role: "Médecin",
    department: "Cardiologie",
    status: "active",
    avatar: "SB"
  },
  {
    id: 2,
    name: "Dr. Pierre Leroy",
    email: "p.leroy@medicare.fr",
    phone: "06 23 45 67 89",
    role: "Médecin",
    department: "Neurologie",
    status: "active",
    avatar: "PL"
  },
  {
    id: 3,
    name: "Marie Dupont",
    email: "m.dupont@medicare.fr",
    phone: "06 34 56 78 90",
    role: "Infirmière",
    department: "Urgences",
    status: "pending",
    avatar: "MD"
  },
  {
    id: 4,
    name: "Dr. Marc Duval",
    email: "m.duval@medicare.fr",
    phone: "06 45 67 89 01",
    role: "Médecin",
    department: "Pédiatrie",
    status: "active",
    avatar: "MD"
  },
  {
    id: 5,
    name: "Claire Martin",
    email: "c.martin@medicare.fr",
    phone: "06 56 78 90 12",
    role: "Secrétaire",
    department: "Administration",
    status: "inactive",
    avatar: "CM"
  },
];

const statusConfig = {
  active: { label: "Actif", color: "bg-success/10 text-success border-success/20", icon: CheckCircle },
  pending: { label: "En attente", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  inactive: { label: "Inactif", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle }
};

export default function Personnel() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPersonnel = personnel.filter(person =>
    person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
        <Button variant="hero" size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Ajouter un membre
        </Button>
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
              const StatusIcon = statusConfig[person.status as keyof typeof statusConfig].icon;
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
                        <p className="font-medium">{person.name}</p>
                        <p className="text-sm text-muted-foreground">{person.role}</p>
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
                    <Badge variant="outline" className={statusConfig[person.status as keyof typeof statusConfig].color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig[person.status as keyof typeof statusConfig].label}
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
                        <DropdownMenuItem>Voir le profil</DropdownMenuItem>
                        <DropdownMenuItem>Modifier</DropdownMenuItem>
                        <DropdownMenuItem>Voir le planning</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Supprimer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}