import { useEffect, useMemo, useState } from "react";
import { Plus, Search, ChevronLeft, ChevronRight, Clock, User, Stethoscope, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { personnelService } from "@/services/personnelService";
import type { Appointment, AppointmentType, Patient, Personnel } from "@/types";
import { apiMessage } from "@/lib/apiError";

const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const typeLabels: Record<AppointmentType, string> = {
  consultation: "Consultation",
  followup: "Suivi",
  exam: "Examen",
  emergency: "Urgence",
};

const statusConfig = {
  confirmed: { label: "Confirmé", color: "bg-success text-success-foreground", icon: Check },
  pending: { label: "En attente", color: "bg-warning text-warning-foreground", icon: Clock },
  completed: { label: "Terminé", color: "bg-primary text-primary-foreground", icon: Check },
  cancelled: { label: "Annulé", color: "bg-destructive text-destructive-foreground", icon: X },
};

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const distance = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + distance);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Appointments() {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => formatIso(new Date()));
  const [searchQuery, setSearchQuery] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Personnel[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    date: formatIso(new Date()),
    time: "09:00",
    duration: "30",
    type: "consultation" as AppointmentType,
    notes: "",
  });

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  }), [weekStart]);

  const load = async () => {
    try {
      const [appointmentResult, patientResult, doctorResult] = await Promise.all([
        appointmentService.getAll({ limit: 100 }),
        patientService.getAll({ limit: 100 }),
        personnelService.getDoctors(),
      ]);
      setAppointments(appointmentResult.data);
      setPatients(patientResult.data);
      setDoctors(doctorResult);
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = appointments.filter((appointment) => {
    const matchesDay = appointment.date === selectedDate;
    const query = searchQuery.toLowerCase();
    const matchesQuery = !query
      || appointment.patientName.toLowerCase().includes(query)
      || appointment.doctorName.toLowerCase().includes(query);
    return matchesDay && matchesQuery;
  });

  const monthLabel = weekStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const createAppointment = async () => {
    if (!form.patientId || !form.doctorId) {
      toast({ variant: "destructive", title: "Erreur", description: "Choisissez un patient et un médecin" });
      return;
    }
    try {
      await appointmentService.create({
        patientId: form.patientId,
        patientName: "",
        doctorId: form.doctorId,
        doctorName: "",
        date: form.date,
        time: form.time,
        duration: Number(form.duration),
        type: form.type,
        notes: form.notes || undefined,
      });
      setOpen(false);
      setSelectedDate(form.date);
      toast({ title: "Rendez-vous créé", description: "Le patient et le médecin sont notifiés s'ils ont un compte." });
      window.dispatchEvent(new Event("notifications:refresh"));
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: apiMessage(error) });
    }
  };

  const renderList = (items: Appointment[]) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground">Aucun rendez-vous</p>;
    }
    return items.map((appointment) => {
      const status = statusConfig[appointment.status];
      const StatusIcon = status.icon;
      return (
        <div key={appointment.id} className="flex flex-col items-start gap-3 rounded-lg bg-secondary/50 p-4 sm:flex-row sm:items-center">
          <div className="text-center min-w-[60px]">
            <p className="text-lg font-bold text-foreground">{appointment.time}</p>
            <p className="text-xs text-muted-foreground">{appointment.duration}min</p>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{appointment.patientName}</p>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Stethoscope className="h-3 w-3" />
              <span>{appointment.doctorName}</span>
              <span>•</span>
              <span>{typeLabels[appointment.type]}</span>
            </div>
          </div>
          <Badge className={status.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rendez-vous</h1>
          <p className="mt-1 text-muted-foreground">Planification et gestion des consultations</p>
        </div>
        <Button variant="hero" size="lg" onClick={() => setOpen(true)}>
          <Plus className="h-5 w-5 mr-2" />
          Nouveau RDV
        </Button>
      </div>

      <Card className="p-4 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setWeekStart((current) => {
            const next = new Date(current);
            next.setDate(current.getDate() - 7);
            return next;
          })}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="px-2 text-center text-sm font-semibold capitalize sm:text-lg">{monthLabel}</h2>
          <Button variant="ghost" size="icon" onClick={() => setWeekStart((current) => {
            const next = new Date(current);
            next.setDate(current.getDate() + 7);
            return next;
          })}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {week.map((date, index) => {
            const iso = formatIso(date);
            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(iso)}
                className={`flex flex-col items-center rounded-lg p-1.5 transition-all duration-200 sm:rounded-xl sm:p-3 ${
                  selectedDate === iso ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-secondary"
                }`}
              >
                <span className="text-xs font-medium opacity-70">{weekDays[index]}</span>
                <span className="mt-1 text-sm font-bold sm:text-lg">{date.getDate()}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher un RDV..." className="pl-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Matin</h3>
          <div className="space-y-3">{renderList(visible.filter((appointment) => appointment.time < "12:00"))}</div>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Après-midi</h3>
          <div className="space-y-3">{renderList(visible.filter((appointment) => appointment.time >= "12:00"))}</div>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau rendez-vous</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select value={form.patientId} onValueChange={(value) => setForm({ ...form, patientId: value })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Médecin</Label>
              <Select value={form.doctorId} onValueChange={(value) => setForm({ ...form, doctorId: value })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>Dr. {doctor.firstName} {doctor.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Heure</Label>
                <Select value={form.time} onValueChange={(value) => setForm({ ...form, time: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Durée (min)</Label>
                <Input type="number" min={5} value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value as AppointmentType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="followup">Suivi</SelectItem>
                    <SelectItem value="exam">Examen</SelectItem>
                    <SelectItem value="emergency">Urgence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </div>
            <Button className="w-full" onClick={createAppointment}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
