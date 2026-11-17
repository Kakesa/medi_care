import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { httpClient } from "@/services/httpClient";
import { apiMessage } from "@/lib/apiError";

const steps = ["Administrateur", "Établissement", "Identité visuelle", "Récapitulatif"];

const facilityOptions = [
  ["hopital", "Hôpital"],
  ["clinique", "Clinique"],
  ["centre_sante", "Centre de santé"],
  ["polyclinique", "Polyclinique"],
  ["autre", "Autre"],
] as const;

type Draft = {
  firstName: string;
  postName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  password: string;
  confirmPassword: string;
  name: string;
  facilityType: string;
  registrationNumber: string;
  address: string;
  commune: string;
  city: string;
  province: string;
  country: string;
  centerPhone: string;
  centerEmail: string;
  logo: string;
  coverImage: string;
  primaryColor: string;
  currency: "USD" | "CDF" | "EUR";
  timezone: string;
  stamp: string;
  resubmit: boolean;
  previousEmail: string;
  previousPassword: string;
};

const initial: Draft = {
  firstName: "", postName: "", lastName: "", email: "", phone: "", jobTitle: "", password: "", confirmPassword: "",
  name: "", facilityType: "clinique", registrationNumber: "", address: "", commune: "", city: "", province: "", country: "République démocratique du Congo",
  centerPhone: "", centerEmail: "", logo: "", coverImage: "", primaryColor: "#0f766e", currency: "USD", timezone: "Africa/Kinshasa", stamp: "",
  resubmit: false, previousEmail: "", previousPassword: "",
};

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (file.size > 1_500_000) {
      reject(new Error("L’image doit faire moins de 1,5 Mo"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image illisible"));
    reader.readAsDataURL(file);
  });
}

export default function HospitalSignup() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [sending, setSending] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const next = () => {
    setError("");
    if (step === 0 && draft.password !== draft.confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas");
      return;
    }
    if (step === 2 && !draft.logo) {
      setError("Le logo est obligatoire");
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError("");
    const body = {
      admin: {
        firstName: draft.firstName, lastName: draft.lastName, postName: draft.postName, email: draft.email,
        phone: draft.phone, jobTitle: draft.jobTitle, password: draft.password, confirmPassword: draft.confirmPassword,
      },
      center: {
        name: draft.name, facilityType: draft.facilityType, registrationNumber: draft.registrationNumber,
        address: draft.address, commune: draft.commune, city: draft.city, province: draft.province, country: draft.country,
        phone: draft.centerPhone, email: draft.centerEmail, logo: draft.logo,
        ...(draft.coverImage ? { coverImage: draft.coverImage } : {}),
        primaryColor: draft.primaryColor, currency: draft.currency, timezone: draft.timezone,
        ...(draft.stamp ? { stamp: draft.stamp } : {}),
      },
    };
    try {
      const result = draft.resubmit
        ? await httpClient.post<{ message: string }>("/auth/resubmit-hospital", { email: draft.previousEmail, password: draft.previousPassword, ...body })
        : await httpClient.post<{ message: string }>("/auth/register-hospital", body);
      setDone(result.message);
    } catch (caught) {
      setError(apiMessage(caught));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <Link to="/login" className="text-sm text-primary">Retour à la connexion</Link>
      <h1 className="mt-4 text-2xl font-bold">Inscription d’un centre</h1>
      <p className="mt-1 text-sm text-muted-foreground">La demande reste en attente jusqu’à la validation du SuperAdmin.</p>
      <div className="mt-4 grid grid-cols-4 gap-1">
        {steps.map((label, index) => (
          <button key={label} type="button" className={`rounded-full px-2 py-1 text-[11px] ${index === step ? "bg-primary text-primary-foreground" : index < step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`} onClick={() => index < step && setStep(index)}>{index + 1}. {label}</button>
        ))}
      </div>
      {done ? <p className="mt-6 rounded-xl border bg-card p-4 text-sm">{done}</p> : (
        <form className="mt-6 space-y-3" onSubmit={submit}>
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={draft.resubmit} onChange={(event) => set({ resubmit: event.target.checked })} />Corriger une demande refusée</label>
              {draft.resubmit && <>
                <div className="space-y-1 sm:col-span-2"><Label>Email de la demande</Label><Input type="email" value={draft.previousEmail} onChange={(event) => set({ previousEmail: event.target.value })} required /></div>
                <div className="space-y-1 sm:col-span-2"><Label>Mot de passe actuel</Label><Input type="password" value={draft.previousPassword} onChange={(event) => set({ previousPassword: event.target.value })} required /></div>
              </>}
              <div className="space-y-1"><Label>Nom</Label><Input value={draft.lastName} onChange={(event) => set({ lastName: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Postnom</Label><Input value={draft.postName} onChange={(event) => set({ postName: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Prénom</Label><Input value={draft.firstName} onChange={(event) => set({ firstName: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Fonction</Label><Input value={draft.jobTitle} onChange={(event) => set({ jobTitle: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={draft.email} onChange={(event) => set({ email: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Téléphone</Label><Input value={draft.phone} onChange={(event) => set({ phone: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Mot de passe</Label><Input type="password" minLength={8} value={draft.password} onChange={(event) => set({ password: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Confirmation</Label><Input type="password" minLength={8} value={draft.confirmPassword} onChange={(event) => set({ confirmPassword: event.target.value })} required /></div>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label>Nom officiel</Label><Input value={draft.name} onChange={(event) => set({ name: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Type</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.facilityType} onChange={(event) => set({ facilityType: event.target.value })}>{facilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="space-y-1"><Label>N° d’enregistrement</Label><Input value={draft.registrationNumber} onChange={(event) => set({ registrationNumber: event.target.value })} required /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Adresse</Label><Input value={draft.address} onChange={(event) => set({ address: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Commune</Label><Input value={draft.commune} onChange={(event) => set({ commune: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Ville</Label><Input value={draft.city} onChange={(event) => set({ city: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Province</Label><Input value={draft.province} onChange={(event) => set({ province: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Pays</Label><Input value={draft.country} onChange={(event) => set({ country: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Téléphone professionnel</Label><Input value={draft.centerPhone} onChange={(event) => set({ centerPhone: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Email professionnel</Label><Input type="email" value={draft.centerEmail} onChange={(event) => set({ centerEmail: event.target.value })} required /></div>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Logo</Label><Input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImage(file).then((logo) => set({ logo })).catch((caught) => setError(caught.message)); }} /></div>
              <div className="space-y-1"><Label>Couverture (facultatif)</Label><Input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImage(file).then((coverImage) => set({ coverImage })).catch((caught) => setError(caught.message)); }} /></div>
              <div className="space-y-1"><Label>Couleur principale</Label><Input type="color" value={draft.primaryColor} onChange={(event) => set({ primaryColor: event.target.value })} /></div>
              <div className="space-y-1"><Label>Devise</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.currency} onChange={(event) => set({ currency: event.target.value as Draft["currency"] })}><option value="USD">USD</option><option value="CDF">CDF</option><option value="EUR">EUR</option></select></div>
              <div className="space-y-1"><Label>Fuseau horaire</Label><Input value={draft.timezone} onChange={(event) => set({ timezone: event.target.value })} required /></div>
              <div className="space-y-1"><Label>Cachet (facultatif)</Label><Input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImage(file).then((stamp) => set({ stamp })).catch((caught) => setError(caught.message)); }} /></div>
              {draft.logo && <img src={draft.logo} alt="" className="h-16 w-16 rounded-xl object-cover" />}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
              <p><span className="text-muted-foreground">Administrateur · </span>{draft.lastName} {draft.postName} {draft.firstName}</p>
              <p><span className="text-muted-foreground">Fonction · </span>{draft.jobTitle}</p>
              <p><span className="text-muted-foreground">Contact · </span>{draft.email} · {draft.phone}</p>
              <p><span className="text-muted-foreground">Centre · </span>{draft.name}</p>
              <p><span className="text-muted-foreground">Adresse · </span>{draft.address}, {draft.commune}, {draft.city}, {draft.province}, {draft.country}</p>
              <p><span className="text-muted-foreground">Configuration · </span>{draft.currency} · {draft.timezone}</p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>Précédent</Button>
            {step < 3 ? <Button type="button" onClick={next}>Continuer</Button> : <Button type="submit" disabled={sending}>{sending ? "Envoi…" : "Envoyer la demande"}</Button>}
          </div>
        </form>
      )}
    </div>
  );
}
