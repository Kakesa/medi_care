import { useState } from "react";
import { Calendar, Clock, User, Phone, Mail, Stethoscope, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { availableDoctors } from "@/data/mockData";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  preferredDate: string;
  preferredTime: string;
  doctorId: string;
  reason: string;
  notes: string;
}

export function AppointmentRequestForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    preferredDate: "",
    preferredTime: "",
    doctorId: "",
    reason: "",
    notes: ""
  });

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast({
      title: "Demande envoyée !",
      description: "Votre demande de rendez-vous a été envoyée. Nous vous contacterons sous 24h pour confirmer.",
    });

    // Reset form
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      preferredDate: "",
      preferredTime: "",
      doctorId: "",
      reason: "",
      notes: ""
    });

    setIsSubmitting(false);
  };

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
  ];

  return (
    <Card className="p-8 bg-card/80 backdrop-blur-sm border-border/50">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Prénom *
            </Label>
            <Input
              id="firstName"
              required
              value={formData.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              placeholder="Votre prénom"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Nom *</Label>
            <Input
              id="lastName"
              required
              value={formData.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              placeholder="Votre nom"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Email *
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="votre@email.fr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Téléphone *
            </Label>
            <Input
              id="phone"
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="06 XX XX XX XX"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date de naissance *</Label>
          <Input
            id="dateOfBirth"
            type="date"
            required
            value={formData.dateOfBirth}
            onChange={(e) => handleChange("dateOfBirth", e.target.value)}
          />
        </div>

        {/* Appointment preferences */}
        <div className="border-t border-border pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Préférences de rendez-vous
          </h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="preferredDate">Date souhaitée *</Label>
              <Input
                id="preferredDate"
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={formData.preferredDate}
                onChange={(e) => handleChange("preferredDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredTime" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Heure préférée *
              </Label>
              <Select value={formData.preferredTime} onValueChange={(value) => handleChange("preferredTime", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une heure" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="doctor" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              Médecin (optionnel)
            </Label>
            <Select value={formData.doctorId} onValueChange={(value) => handleChange("doctorId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un médecin ou laisser vide" />
              </SelectTrigger>
              <SelectContent>
                {availableDoctors.map(doctor => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    Dr. {doctor.firstName} {doctor.lastName} - {doctor.department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <Label htmlFor="reason">Motif de consultation *</Label>
          <Select value={formData.reason} onValueChange={(value) => handleChange("reason", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez un motif" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consultation">Consultation générale</SelectItem>
              <SelectItem value="followup">Suivi médical</SelectItem>
              <SelectItem value="exam">Examen médical</SelectItem>
              <SelectItem value="vaccination">Vaccination</SelectItem>
              <SelectItem value="certificate">Certificat médical</SelectItem>
              <SelectItem value="other">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Informations complémentaires</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Décrivez brièvement vos symptômes ou le motif de votre visite..."
            rows={4}
          />
        </div>

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            "Envoi en cours..."
          ) : (
            <>
              <Send className="h-5 w-5 mr-2" />
              Envoyer ma demande
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Nous vous contacterons par téléphone ou email pour confirmer votre rendez-vous sous 24h.
        </p>
      </form>
    </Card>
  );
}
