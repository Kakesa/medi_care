import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { httpClient } from "@/services/httpClient";
import { apiMessage } from "@/lib/apiError";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { isEmail, spamTrapFilled } from "@/lib/formChecks";

const steps = [
  { short: "Admin", label: "Administrateur" },
  { short: "Centre", label: "Établissement" },
  { short: "Visuel", label: "Identité visuelle" },
  { short: "Résumé", label: "Récapitulatif" },
];

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
};

const initial: Draft = {
  firstName: "", postName: "", lastName: "", email: "", phone: "", jobTitle: "", password: "", confirmPassword: "",
  name: "", facilityType: "clinique", registrationNumber: "", address: "", commune: "", city: "", province: "", country: "République démocratique du Congo",
  centerPhone: "", centerEmail: "", logo: "", coverImage: "", primaryColor: "#0f766e", currency: "USD", timezone: "Africa/Kinshasa", stamp: "",
};

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ImagePick({ label, hint, value, onPick }: { label: string; hint: string; value: string; onPick: (file: File) => void }) {
  return (
    <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-3">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      {value ? <img src={value} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <span className="text-xs text-muted-foreground">Aucune image</span>}
      <Input type="file" accept="image/*" className="cursor-pointer" onChange={(event) => { const file = event.target.files?.[0]; if (file) onPick(file); }} />
    </label>
  );
}

export default function HospitalSignup() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [sending, setSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const missing = (fields: Array<[string, string]>) => fields.find(([, value]) => !value.trim())?.[0];

  const next = () => {
    setError("");
    if (step === 0) {
      const gap = missing([
        ["Nom", draft.lastName], ["Postnom", draft.postName], ["Prénom", draft.firstName], ["Fonction", draft.jobTitle],
        ["Email", draft.email], ["Téléphone", draft.phone], ["Mot de passe", draft.password], ["Confirmation", draft.confirmPassword],
      ]);
      if (gap) {
        setError(`${gap} est obligatoire`);
        return;
      }
      if (!isEmail(draft.email)) {
        setError("L'email de l'administrateur est invalide");
        return;
      }
      if (draft.phone.trim().length < 6) {
        setError("Le téléphone doit contenir au moins 6 caractères");
        return;
      }
      if (draft.password.length < 8 || draft.password.length > 128) {
        setError("Le mot de passe doit contenir entre 8 et 128 caractères");
        return;
      }
      if (draft.password !== draft.confirmPassword) {
        setError("La confirmation du mot de passe ne correspond pas");
        return;
      }
    }
    if (step === 1) {
      const gap = missing([
        ["Nom officiel", draft.name], ["N° d’enregistrement", draft.registrationNumber], ["Adresse", draft.address],
        ["Commune", draft.commune], ["Ville", draft.city], ["Province", draft.province], ["Pays", draft.country],
        ["Téléphone professionnel", draft.centerPhone], ["Email professionnel", draft.centerEmail],
      ]);
      if (gap) {
        setError(`${gap} est obligatoire`);
        return;
      }
      if (!isEmail(draft.centerEmail)) {
        setError("L'email professionnel est invalide");
        return;
      }
      if (draft.centerPhone.trim().length < 6) {
        setError("Le téléphone professionnel doit contenir au moins 6 caractères");
        return;
      }
    }
    if (step === 2 && !draft.logo) {
      setError("Le logo est obligatoire");
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (spamTrapFilled(event.currentTarget)) return;
    setSending(true);
    setError("");
    const body = {
      website: "",
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
      const result = await httpClient.post<{ message: string }>("/auth/register-hospital", body);
      setDone(result.message);
    } catch (caught) {
      setError(apiMessage(caught));
    } finally {
      setSending(false);
    }
  };

  const facilityLabel = facilityOptions.find(([value]) => value === draft.facilityType)?.[1] || draft.facilityType;

  return (
    <AuthScreen title="Inscription d’un centre" backTo="/register" wide footer={!done ? <Link to="/confidentialite" className="text-xs hover:text-primary">Confidentialité</Link> : undefined}>
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">La demande reste en attente jusqu’à la validation du SuperAdmin.</p>

        <ol className="grid grid-cols-4 gap-2">
          {steps.map((item, index) => {
            const active = index === step;
            const passed = index < step;
            return (
              <li key={item.label}>
                <button
                  type="button"
                  disabled={index > step}
                  onClick={() => index < step && setStep(index)}
                  className="flex w-full flex-col items-center gap-1.5 disabled:cursor-default"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : passed ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {passed ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className={`text-center text-[11px] leading-tight sm:text-xs ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    <span className="sm:hidden">{item.short}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div>
          {done ? (
            <div className="space-y-4 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary"><Check className="h-6 w-6" /></span>
              <p className="text-sm">{done}</p>
              <Button variant="hero" className="h-12 w-full rounded-full" asChild><Link to="/login">Retour à la connexion</Link></Button>
            </div>
          ) : (
            <form className="space-y-4" autoComplete="off" onSubmit={submit}>
              <HoneypotField />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Étape {step + 1} sur {steps.length}</p>
                <h2 className="text-lg font-semibold">{steps[step].label}</h2>
              </div>

              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nom"><Input autoComplete="family-name" value={draft.lastName} onChange={(event) => set({ lastName: event.target.value })} placeholder="Mukendi" /></Field>
                  <Field label="Postnom"><Input value={draft.postName} onChange={(event) => set({ postName: event.target.value })} placeholder="Ilunga" /></Field>
                  <Field label="Prénom"><Input autoComplete="given-name" value={draft.firstName} onChange={(event) => set({ firstName: event.target.value })} placeholder="Amina" /></Field>
                  <Field label="Fonction"><Input value={draft.jobTitle} onChange={(event) => set({ jobTitle: event.target.value })} placeholder="Directeur médical" /></Field>
                  <Field label="Email"><Input type="email" autoComplete="off" value={draft.email} onChange={(event) => set({ email: event.target.value })} placeholder="admin@centre.cd" /></Field>
                  <Field label="Téléphone"><Input type="tel" value={draft.phone} onChange={(event) => set({ phone: event.target.value })} placeholder="+243 …" /></Field>
                  <Field label="Mot de passe">
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={draft.password} onChange={(event) => set({ password: event.target.value })} placeholder="8 caractères minimum" />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirmation"><Input type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={draft.confirmPassword} onChange={(event) => set({ confirmPassword: event.target.value })} placeholder="Répéter le mot de passe" /></Field>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Field label="Nom officiel"><Input value={draft.name} onChange={(event) => set({ name: event.target.value })} placeholder="Clinique …" /></Field></div>
                  <Field label="Type">
                    <select className={selectClass} value={draft.facilityType} onChange={(event) => set({ facilityType: event.target.value })}>
                      {facilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                  <Field label="N° d’enregistrement"><Input value={draft.registrationNumber} onChange={(event) => set({ registrationNumber: event.target.value })} /></Field>
                  <div className="sm:col-span-2"><Field label="Adresse"><Input value={draft.address} onChange={(event) => set({ address: event.target.value })} placeholder="Avenue, numéro" /></Field></div>
                  <Field label="Commune"><Input value={draft.commune} onChange={(event) => set({ commune: event.target.value })} /></Field>
                  <Field label="Ville"><Input value={draft.city} onChange={(event) => set({ city: event.target.value })} /></Field>
                  <Field label="Province"><Input value={draft.province} onChange={(event) => set({ province: event.target.value })} /></Field>
                  <Field label="Pays"><Input value={draft.country} onChange={(event) => set({ country: event.target.value })} /></Field>
                  <Field label="Téléphone professionnel"><Input type="tel" value={draft.centerPhone} onChange={(event) => set({ centerPhone: event.target.value })} /></Field>
                  <Field label="Email professionnel"><Input type="email" value={draft.centerEmail} onChange={(event) => set({ centerEmail: event.target.value })} /></Field>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <ImagePick label="Logo" hint="Obligatoire · 1,5 Mo maximum" value={draft.logo} onPick={(file) => { void readImage(file).then((logo) => set({ logo })).catch((caught: Error) => setError(caught.message)); }} />
                  <ImagePick label="Couverture" hint="Facultatif" value={draft.coverImage} onPick={(file) => { void readImage(file).then((coverImage) => set({ coverImage })).catch((caught: Error) => setError(caught.message)); }} />
                  <ImagePick label="Cachet" hint="Facultatif" value={draft.stamp} onPick={(file) => { void readImage(file).then((stamp) => set({ stamp })).catch((caught: Error) => setError(caught.message)); }} />
                  <div className="space-y-4">
                    <Field label="Couleur principale">
                      <div className="flex items-center gap-3">
                        <Input type="color" className="h-10 w-14 p-1" value={draft.primaryColor} onChange={(event) => set({ primaryColor: event.target.value })} />
                        <span className="text-sm text-muted-foreground">{draft.primaryColor}</span>
                      </div>
                    </Field>
                    <Field label="Devise">
                      <select className={selectClass} value={draft.currency} onChange={(event) => set({ currency: event.target.value as Draft["currency"] })}>
                        <option value="USD">Dollar américain (USD)</option>
                        <option value="CDF">Franc congolais (CDF)</option>
                        <option value="EUR">Euro (EUR)</option>
                      </select>
                    </Field>
                    <Field label="Fuseau horaire"><Input value={draft.timezone} onChange={(event) => set({ timezone: event.target.value })} /></Field>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                    {draft.logo ? <img src={draft.logo} alt="" className="h-14 w-14 rounded-xl object-cover" /> : null}
                    <div>
                      <p className="font-semibold">{draft.name}</p>
                      <p className="text-muted-foreground">{facilityLabel} · {draft.registrationNumber}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Administrateur", `${draft.lastName} ${draft.postName} ${draft.firstName}`],
                      ["Fonction", draft.jobTitle],
                      ["Email", draft.email],
                      ["Téléphone", draft.phone],
                      ["Adresse", `${draft.address}, ${draft.commune}`],
                      ["Localisation", `${draft.city}, ${draft.province}, ${draft.country}`],
                      ["Contact du centre", `${draft.centerEmail} · ${draft.centerPhone}`],
                      ["Réglages", `${draft.currency} · ${draft.timezone}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-muted/40 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="h-12 flex-1 whitespace-nowrap rounded-full" disabled={step === 0} onClick={() => { setError(""); setStep((current) => current - 1); }}>
                  <ArrowLeft className="h-4 w-4" />
                  Précédent
                </Button>
                {step < 3 ? (
                  <Button type="button" variant="hero" className="h-12 flex-[1.3] whitespace-nowrap rounded-full" onClick={next}>
                    Continuer
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" variant="hero" className="h-12 flex-[1.3] whitespace-nowrap rounded-full" disabled={sending}>
                    {sending ? "Envoi…" : "Envoyer"}
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </AuthScreen>
  );
}
