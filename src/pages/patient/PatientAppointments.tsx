import { useEffect, useRef, useState } from "react";
import { Calendar, Check, Clock, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiMessage } from "@/lib/apiError";
import { appointmentService } from "@/services/appointmentService";
import { personnelService } from "@/services/personnelService";
import type { Appointment, AppointmentType, Personnel } from "@/types";

const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const typeLabels: Record<AppointmentType, string> = {
  consultation: "Consultation",
  followup: "Suivi",
  exam: "Examen",
  emergency: "Urgence",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmé",
  pending: "En attente",
  cancelled: "Annulé",
  completed: "Terminé",
};

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function PatientAppointments() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const requestingRef = useRef(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState({
    doctorId: "",
    date: todayIso(),
    time: "09:00",
    duration: "30",
    type: "consultation" as AppointmentType,
    notes: "",
  });

  const load = async () => {
    try {
      const result = await appointmentService.getAll({ limit: 100 });
      setAppointments(result.data);
    } catch (error) {
      toast({ variant: "destructive", title: "Rendez-vous indisponibles", description: apiMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openRequest = async () => {
    setRequestOpen(true);
    if (doctors.length > 0) return;
    try {
      setDoctors(await personnelService.getDoctors());
    } catch (error) {
      toast({ variant: "destructive", title: "Médecins indisponibles", description: apiMessage(error) });
    }
  };

  const requestAppointment = async () => {
    if (requestingRef.current) return;
    if (!requestForm.doctorId) {
      toast({ variant: "destructive", title: "Médecin requis", description: "Choisissez un médecin." });
      return;
    }
    requestingRef.current = true;
    setRequesting(true);
    try {
      const created = await appointmentService.request({
        doctorId: requestForm.doctorId,
        date: requestForm.date,
        time: requestForm.time,
        duration: Number(requestForm.duration),
        type: requestForm.type,
        notes: requestForm.notes || undefined,
      });
      setAppointments((current) => [created, ...current]);
      setRequestOpen(false);
      window.dispatchEvent(new Event("notifications:refresh"));
      toast({ title: "Demande envoyée", description: "Le médecin est prévenu et peut accepter le rendez-vous." });
    } catch (error) {
      toast({ variant: "destructive", title: "Demande impossible", description: apiMessage(error) });
    } finally {
      requestingRef.current = false;
      setRequesting(false);
    }
  };

  const respond = async (id: string, decision: "accept" | "decline") => {
    setRespondingId(id);
    try {
      const updated = decision === "accept"
        ? await appointmentService.accept(id)
        : await appointmentService.decline(id);
      setAppointments((current) => current.map((item) => item.id === id ? updated : item));
      window.dispatchEvent(new Event("notifications:refresh"));
      toast({
        title: decision === "accept" ? "Rendez-vous accepté" : "Rendez-vous refusé",
        description: decision === "accept" ? "Le médecin est informé." : "Le médecin est informé de votre refus.",
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Réponse impossible", description: apiMessage(error) });
    } finally {
      setRespondingId(null);
    }
  };

  const sorted = [...appointments].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rendez-vous</h1>
          <p className="mt-1 text-muted-foreground">Vos demandes et les rendez-vous proposés par l'établissement.</p>
        </div>
        <Button onClick={() => void openRequest()}>Demander un rendez-vous</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement des rendez-vous...</p>
      ) : sorted.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun rendez-vous</p>
            <Button className="mt-4" size="sm" onClick={() => void openRequest()}>Prendre rendez-vous</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((apt) => (
            <Card key={apt.id} className="card-elevated">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{apt.doctorName}</p>
                    <p className="text-sm text-muted-foreground">{apt.date} à {apt.time}</p>
                    <p className="text-xs text-muted-foreground">{typeLabels[apt.type] || apt.type}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={apt.status === "cancelled" ? "destructive" : apt.status === "confirmed" ? "default" : "secondary"}>
                    {statusLabels[apt.status] || apt.status}
                  </Badge>
                  {apt.status === "pending" && apt.requestedBy !== "patient" && (
                    <>
                      <Button size="sm" onClick={() => respond(apt.id, "accept")} disabled={respondingId === apt.id}>
                        <Check className="mr-1 h-4 w-4" />Accepter
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => respond(apt.id, "decline")} disabled={respondingId === apt.id}>
                        <X className="mr-1 h-4 w-4" />Refuser
                      </Button>
                    </>
                  )}
                  {apt.status === "pending" && apt.requestedBy === "patient" && (
                    <Button size="sm" variant="outline" onClick={() => respond(apt.id, "decline")} disabled={respondingId === apt.id}>
                      Annuler
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={requestOpen} onOpenChange={(next) => { if (!requestingRef.current) setRequestOpen(next); }}>
        <DialogContent
          className="flex max-w-lg flex-col gap-0 overflow-hidden p-0 sm:p-0"
          onEscapeKeyDown={(event) => { if (requesting) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (requesting) event.preventDefault(); }}
        >
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>Demander un rendez-vous</DialogTitle>
            <DialogDescription>Le médecin reçoit votre demande et la confirme.</DialogDescription>
          </DialogHeader>
          <fieldset disabled={requesting} className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <Label>Médecin</Label>
              <Select value={requestForm.doctorId} onValueChange={(doctorId) => setRequestForm({ ...requestForm, doctorId })} disabled={requesting}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un médecin" /></SelectTrigger>
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
                <Input type="date" value={requestForm.date} onChange={(event) => setRequestForm({ ...requestForm, date: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Heure</Label>
                <Select value={requestForm.time} onValueChange={(time) => setRequestForm({ ...requestForm, time })} disabled={requesting}>
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
                <Input type="number" min={5} value={requestForm.duration} onChange={(event) => setRequestForm({ ...requestForm, duration: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={requestForm.type} onValueChange={(type) => setRequestForm({ ...requestForm, type: type as AppointmentType })} disabled={requesting}>
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
              <Label>Motif</Label>
              <Textarea value={requestForm.notes} placeholder="Décrivez brièvement le motif" onChange={(event) => setRequestForm({ ...requestForm, notes: event.target.value })} />
            </div>
          </fieldset>
          <div className="shrink-0 border-t bg-background px-5 py-4">
            <Button className="w-full" type="button" disabled={requesting} onClick={() => void requestAppointment()}>
              {requesting ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi...</> : "Envoyer la demande"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
