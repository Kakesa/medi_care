import { useState } from "react";
import { 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  User,
  Stethoscope,
  Check,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const timeSlots = [
  "08:00", "09:00", "10:00", "11:00", "12:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00"
];

const appointments = [
  { id: 1, time: "09:00", patient: "Jean Martin", doctor: "Dr. Sophie Bernard", type: "Consultation", status: "confirmed", duration: 30 },
  { id: 2, time: "09:30", patient: "Claire Dubois", doctor: "Dr. Sophie Bernard", type: "Suivi", status: "confirmed", duration: 30 },
  { id: 3, time: "10:30", patient: "Michel Petit", doctor: "Dr. Pierre Leroy", type: "Examen", status: "pending", duration: 60 },
  { id: 4, time: "14:00", patient: "Anne Richard", doctor: "Dr. Sophie Bernard", type: "Consultation", status: "confirmed", duration: 30 },
  { id: 5, time: "15:00", patient: "Paul Moreau", doctor: "Dr. Marc Duval", type: "Suivi", status: "cancelled", duration: 30 },
  { id: 6, time: "16:00", patient: "Emma Lefevre", doctor: "Dr. Pierre Leroy", type: "Consultation", status: "pending", duration: 45 },
];

const statusConfig = {
  confirmed: { label: "Confirmé", color: "bg-success text-success-foreground", icon: Check },
  pending: { label: "En attente", color: "bg-warning text-warning-foreground", icon: Clock },
  cancelled: { label: "Annulé", color: "bg-destructive text-destructive-foreground", icon: X }
};

const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const currentWeek = [20, 21, 22, 23, 24, 25, 26];

export default function Appointments() {
  const [selectedDate, setSelectedDate] = useState(22);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rendez-vous</h1>
          <p className="mt-1 text-muted-foreground">
            Planification et gestion des consultations
          </p>
        </div>
        <Button variant="hero" size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Nouveau RDV
        </Button>
      </div>

      {/* Calendar navigation */}
      <Card className="p-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">Janvier 2024</h2>
          <Button variant="ghost" size="icon">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => (
            <button
              key={day}
              onClick={() => setSelectedDate(currentWeek[index])}
              className={`flex flex-col items-center p-3 rounded-xl transition-all duration-200 ${
                selectedDate === currentWeek[index]
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "hover:bg-secondary"
              }`}
            >
              <span className="text-xs font-medium opacity-70">{day}</span>
              <span className="text-lg font-bold mt-1">{currentWeek[index]}</span>
              {currentWeek[index] === 22 && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1" />
              )}
            </button>
          ))}
        </div>
      </Card>

      {/* Search */}
      <div className="flex gap-4 animate-slide-up" style={{ animationDelay: "150ms" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Rechercher un RDV..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Appointments list */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Matin
          </h3>
          <div className="space-y-3">
            {appointments.filter(apt => parseInt(apt.time) < 12).map((apt, index) => {
              const StatusIcon = statusConfig[apt.status as keyof typeof statusConfig].icon;
              return (
                <div 
                  key={apt.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors animate-fade-in"
                  style={{ animationDelay: `${250 + index * 50}ms` }}
                >
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold text-foreground">{apt.time}</p>
                    <p className="text-xs text-muted-foreground">{apt.duration}min</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{apt.patient}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Stethoscope className="h-3 w-3" />
                      <span>{apt.doctor}</span>
                      <span>•</span>
                      <span>{apt.type}</span>
                    </div>
                  </div>
                  <Badge className={statusConfig[apt.status as keyof typeof statusConfig].color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig[apt.status as keyof typeof statusConfig].label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 animate-slide-up" style={{ animationDelay: "250ms" }}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Après-midi
          </h3>
          <div className="space-y-3">
            {appointments.filter(apt => parseInt(apt.time) >= 12).map((apt, index) => {
              const StatusIcon = statusConfig[apt.status as keyof typeof statusConfig].icon;
              return (
                <div 
                  key={apt.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors animate-fade-in"
                  style={{ animationDelay: `${300 + index * 50}ms` }}
                >
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold text-foreground">{apt.time}</p>
                    <p className="text-xs text-muted-foreground">{apt.duration}min</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{apt.patient}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Stethoscope className="h-3 w-3" />
                      <span>{apt.doctor}</span>
                      <span>•</span>
                      <span>{apt.type}</span>
                    </div>
                  </div>
                  <Badge className={statusConfig[apt.status as keyof typeof statusConfig].color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig[apt.status as keyof typeof statusConfig].label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}