import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Clock3, Printer, X, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiMessage } from '@/lib/apiError';
import { useToast } from '@/hooks/use-toast';
import { PatientSelect } from '@/components/patients/PatientSelect';
import { nursingService } from '@/services/nursingService';
import type { MedicationAdministration, MedicationAdministrationSheet, NursingPatient, NursingPatientDetail } from '@/types/nursing';

const timeZone = 'Africa/Kinshasa';

const statusLabels = {
  pending: 'À faire',
  administered_on_time: 'Effectué',
  administered_late: 'Effectué en retard',
  not_administered: 'Non effectué',
  patient_refused: 'Refus du patient',
  suspended: 'Suspendu',
  treatment_completed: 'Traitement terminé',
  treatment_interrupted: 'Traitement interrompu',
} as const;

type ReasonType = 'patient_absent' | 'patient_refused' | 'unavailable' | 'other';
type MotifMode = 'late' | 'missed' | 'correct';

const reasonLabels: Record<ReasonType, string> = {
  patient_refused: 'Refus du patient',
  patient_absent: 'Patient absent',
  unavailable: 'Médicament indisponible',
  other: 'Autre motif',
};

function facilityDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function clock(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(value));
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00.000Z`));
}

const administrationRoutes = ['Orale', 'Intraveineuse', 'Intramusculaire', 'Sous-cutanée', 'Rectale', 'Inhalation'] as const;

function lineId(item: { id?: string; _id?: string }) {
  return item.id || item._id || '';
}

function frequencyLabel(times: string[]) {
  if (times.length === 1) return '1 fois / jour';
  if (times.length > 1) return `${times.length} fois / jour`;
  return '—';
}

const defaultFirstDose: Record<string, string> = { '1': '06:00', '2': '08:00', '3': '08:00', '4': '06:00' };
const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutesOf(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function clockOf(totalMinutes: number) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function previewTimes(input: {
  timesPerDay: number;
  mode: 'automatic' | 'custom';
  firstDose: string;
  windowStart: string;
  windowEnd: string;
  customTimes: string[];
}) {
  if (input.mode === 'custom') {
    if (input.customTimes.length !== input.timesPerDay || input.customTimes.some((time) => !clockPattern.test(time))) {
      return { times: [] as string[], error: 'Indiquez une heure valide pour chaque prise.' };
    }
    if (new Set(input.customTimes).size !== input.customTimes.length) return { times: [] as string[], error: 'Les heures doivent être différentes.' };
    return { times: [...input.customTimes].sort(), error: '' };
  }
  if (![input.firstDose, input.windowStart, input.windowEnd].every((time) => clockPattern.test(time))) {
    return { times: [] as string[], error: 'Indiquez des heures au format HH:mm.' };
  }
  const windowMinutes = minutesOf(input.windowEnd) - minutesOf(input.windowStart);
  if (windowMinutes <= 0) return { times: [] as string[], error: 'La fin de la plage doit suivre son début.' };
  if (input.timesPerDay <= 1) return { times: [input.firstDose], error: '' };
  const interval = windowMinutes === 12 * 60
    ? ({ 2: 8 * 60, 3: 4 * 60, 4: 4 * 60 } as Record<number, number>)[input.timesPerDay] ?? Math.round(windowMinutes / input.timesPerDay)
    : Math.round(windowMinutes / input.timesPerDay);
  const first = minutesOf(input.firstDose);
  const times: string[] = [];
  for (let index = 0; index < input.timesPerDay; index += 1) {
    const total = first + index * interval;
    if (total >= 24 * 60) return { times: [] as string[], error: 'Les prises dépassent minuit. Avancez la première prise ou saisissez les heures du médecin.' };
    times.push(clockOf(total));
  }
  if (new Set(times).size !== times.length) return { times: [] as string[], error: 'Deux prises tombent à la même heure.' };
  return { times, error: '' };
}

function treatmentCue(startDate?: string, endDate?: string, status?: string) {
  if (status === 'completed') return { label: 'Traitement terminé', tone: 'done' as const, className: 'bg-emerald-600 text-white' };
  if (status === 'interrupted') return { label: 'Traitement interrompu', tone: 'stopped' as const, className: 'bg-rose-600 text-white' };
  if (!startDate || !endDate) return null;
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  const today = Date.parse(`${facilityDate()}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  if (today > end) return { label: 'Traitement terminé', tone: 'done' as const, className: 'bg-emerald-600 text-white' };
  const totalDays = Math.floor((end - start) / 86_400_000) + 1;
  if (today < start) {
    const wait = Math.floor((start - today) / 86_400_000);
    return { label: `Débute dans ${wait} jour${wait > 1 ? 's' : ''}`, tone: 'upcoming' as const, className: 'bg-sky-600 text-white' };
  }
  const remaining = totalDays - (Math.floor((today - start) / 86_400_000) + 1);
  if (remaining <= 0) return { label: 'Dernier jour', tone: 'remaining' as const, className: 'bg-amber-500 text-white' };
  return { label: `${remaining} jour${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`, tone: 'remaining' as const, className: 'bg-amber-500 text-white' };
}

function dayStillDue(date: string, startDate?: string, endDate?: string, status?: string) {
  if (status === 'completed' || status === 'interrupted' || !startDate || !endDate) return false;
  return date >= facilityDate() && date >= startDate && date <= endDate;
}

function doseTone(dose: MedicationAdministration) {
  if (dose.status === 'administered_on_time') return 'green';
  if (dose.status === 'administered_late') return 'yellow';
  if (dose.status === 'not_administered' || dose.status === 'patient_refused') return 'red';
  if (!isClosed(dose) && new Date(dose.scheduledAt).getTime() < Date.now()) return 'yellow';
  return 'open';
}

function isClosed(dose: MedicationAdministration) {
  if (dose.status === 'administered_on_time' || dose.status === 'administered_late' || dose.status === 'patient_refused') return true;
  if (dose.status === 'suspended' || dose.status === 'treatment_completed' || dose.status === 'treatment_interrupted') return true;
  if (dose.status === 'not_administered') {
    return Boolean(dose.notDoneReason) || dose.history.some((entry) => entry.action === 'NOT_ADMINISTERED');
  }
  return false;
}

const earlyWindowMs = 2 * 60 * 60 * 1000;

function canConfirm(dose: MedicationAdministration) {
  if (isClosed(dose)) return false;
  return new Date(dose.scheduledAt).getTime() - earlyWindowMs <= Date.now();
}

function canMarkMissed(dose: MedicationAdministration) {
  if (isClosed(dose)) return false;
  return new Date(dose.scheduledAt).getTime() <= Date.now();
}

function isLate(dose: MedicationAdministration) {
  return Date.now() > new Date(dose.scheduledAt).getTime();
}

function doseMotif(dose: MedicationAdministration) {
  if (dose.status === 'administered_late') return dose.observations?.trim() || '';
  if (dose.status === 'not_administered' || dose.status === 'patient_refused') return dose.notDoneReason?.trim() || '';
  return '';
}

function DoseControls({
  dose,
  medication,
  day,
  canWrite,
  shown,
  onToggle,
  onOpen,
  onConfirm,
}: {
  dose: MedicationAdministration;
  medication: string;
  day: string;
  canWrite: boolean;
  shown: boolean;
  onToggle: () => void;
  onOpen: (mode: MotifMode) => void;
  onConfirm: () => void;
}) {
  const closed = isClosed(dose);
  const checked = dose.status === 'administered_on_time' || dose.status === 'administered_late';
  const waiting = !closed && new Date(dose.scheduledAt).getTime() < Date.now();
  const tone = doseTone(dose);
  const toneClass = tone === 'green'
    ? 'border-green-700 bg-green-600 text-white'
    : tone === 'yellow'
      ? 'border-amber-600 bg-amber-400 text-amber-950'
      : tone === 'red'
        ? 'border-red-700 bg-red-600 text-white'
        : 'border-slate-400 bg-white text-transparent';
  const title = tone === 'green'
    ? 'Pris à l’heure'
    : dose.status === 'administered_late'
      ? 'Pris en retard'
      : waiting
        ? 'En retard, à confirmer'
        : tone === 'red'
          ? 'Prise non effectuée'
          : canConfirm(dose)
            ? 'À administrer'
            : 'Pas encore l’heure';
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canWrite || !canConfirm(dose)}
          aria-label={`${medication} ${clock(dose.scheduledAt)} ${day}`}
          title={title}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border sm:h-6 sm:w-6 ${toneClass} disabled:cursor-not-allowed ${!closed && !canConfirm(dose) ? 'opacity-40' : ''}`}
          onClick={() => { if (isLate(dose)) onOpen('late'); else onConfirm(); }}
        >
          {tone === 'red' ? <X className="h-4 w-4" /> : checked ? <Check className="h-4 w-4" /> : null}
        </button>
        <span className={`text-sm sm:text-xs ${waiting ? 'font-semibold text-amber-700' : ''}`}>{clock(dose.scheduledAt)}</span>
      </div>
      {dose.administeredByName && <p className="text-xs text-muted-foreground sm:text-[11px]">{dose.administeredByName} · {dose.administeredAt ? clock(dose.administeredAt) : ''}</p>}
      {doseMotif(dose) && (
        <div>
          <button type="button" className="text-xs underline sm:text-[11px]" onClick={onToggle}>
            {shown ? 'Masquer le motif' : 'Voir le motif'}
          </button>
          {shown && <p className={`text-xs sm:text-[11px] ${dose.status === 'administered_late' ? 'text-amber-800' : 'text-red-700'}`}>{doseMotif(dose)}</p>}
        </div>
      )}
      {canWrite && canMarkMissed(dose) && (
        <button type="button" className="text-xs text-destructive underline sm:text-[11px]" onClick={() => onOpen('missed')}>Non effectué</button>
      )}
      {canWrite && closed && (checked || dose.status === 'not_administered' || dose.status === 'patient_refused') && (
        <button type="button" className="block text-xs text-muted-foreground underline sm:text-[11px]" onClick={() => onOpen('correct')}>Corriger avec motif</button>
      )}
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

export function TreatmentSheet({
  patients,
  selectedId,
  onSelectPatient,
  detail,
  canWrite,
  onChanged,
}: {
  patients: NursingPatient[];
  selectedId: string;
  onSelectPatient: (id: string) => void;
  detail: NursingPatientDetail | null;
  canWrite: boolean;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(facilityDate());
  const [sheets, setSheets] = useState<MedicationAdministrationSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [motif, setMotif] = useState<{ dose: MedicationAdministration; mode: MotifMode; medication: string } | null>(null);
  const [reasonType, setReasonType] = useState<ReasonType>('patient_refused');
  const [reason, setReason] = useState('');
  const [savingMotif, setSavingMotif] = useState(false);
  const [shownMotifs, setShownMotifs] = useState<Record<string, boolean>>({});
  const [newMedication, setNewMedication] = useState('');
  const [newTimes, setNewTimes] = useState('1');
  const [newRoute, setNewRoute] = useState('Orale');
  const [firstDose, setFirstDose] = useState('06:00');
  const [scheduleDraft, setScheduleDraft] = useState<{
    rowId: string; prescriptionId: string; medication: string; route: string;
    timesPerDay: string; mode: 'automatic' | 'custom'; firstDose: string;
    windowStart: string; windowEnd: string; customTimes: string[]; startDate: string; endDate: string;
  } | null>(null);
  const [schedulingId, setSchedulingId] = useState('');
  const [adding, setAdding] = useState(false);
  const addFormRef = useRef<HTMLFormElement>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const todayIndex = days.indexOf(facilityDate());

  useEffect(() => {
    if (!selectedId) {
      setSheets([]);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all(days.map((date) => nursingService.getAdministrations(selectedId, date)))
      .then((value) => { if (active) setSheets(value); })
      .catch((error) => { if (active) toast({ title: 'Feuille indisponible', description: apiMessage(error), variant: 'destructive' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedId, days, toast]);

  const doses = sheets.flatMap((sheet, dayIndex) => sheet.doses.map((dose) => ({ ...dose, dayIndex })));
  const rows = useMemo(() => {
    const schedule = new Map<string, { start?: string; end?: string; status?: string }>();
    for (const prescription of detail?.prescriptions ?? []) {
      for (const item of prescription.items) {
        const id = lineId(item);
        if (id) schedule.set(id, { start: item.treatmentStartDate, end: item.treatmentEndDate, status: item.treatmentStatus });
      }
    }
    const grouped = new Map<string, { id: string; prescriptionId: string; medication: string; dose: string; route: string; posology: string; times: string[]; cells: MedicationAdministration[][]; start?: string; end?: string; status?: string }>();
    for (const dose of doses) {
      const info = schedule.get(dose.prescriptionItemId);
      const current = grouped.get(dose.prescriptionItemId) ?? {
        id: dose.prescriptionItemId,
        prescriptionId: dose.prescriptionId,
        medication: dose.medication,
        dose: dose.prescribedDose,
        route: dose.administrationRoute,
        posology: dose.posology,
        times: [],
        cells: days.map(() => []),
        start: info?.start,
        end: info?.end,
        status: info?.status,
      };
      current.cells[dose.dayIndex]?.push(dose);
      const time = clock(dose.scheduledAt);
      if (!current.times.includes(time)) current.times.push(time);
      grouped.set(dose.prescriptionItemId, current);
    }
    for (const prescription of detail?.prescriptions ?? []) {
      for (const item of prescription.items) {
        const id = lineId(item);
        if (!id || grouped.has(id) || !item.administrationTimes?.length) continue;
        const start = item.treatmentStartDate;
        const end = item.treatmentEndDate;
        const overlaps = !start || !end || !(end < days[0] || start > days[6]);
        if (!overlaps) continue;
        grouped.set(id, {
          id,
          prescriptionId: prescription.id,
          medication: item.medication,
          dose: item.dosage,
          route: item.administrationRoute || '',
          posology: item.posology,
          times: item.administrationTimes ?? [],
          cells: days.map(() => []),
          start: item.treatmentStartDate,
          end: item.treatmentEndDate,
          status: item.treatmentStatus,
        });
      }
    }
    return [...grouped.values()].sort((a, b) => a.medication.localeCompare(b.medication, 'fr'));
  }, [doses, detail?.prescriptions, days]);

  const counts = useMemo(() => ({
    done: doses.filter((dose) => dose.status === 'administered_on_time' || dose.status === 'administered_late').length,
    late: doses.filter((dose) => dose.status === 'administered_late' || (!isClosed(dose) && new Date(dose.scheduledAt).getTime() + 60 * 60_000 < Date.now())).length,
    missed: doses.filter((dose) => isClosed(dose) && (dose.status === 'not_administered' || dose.status === 'patient_refused')).length,
  }), [doses]);

  const reloadSheet = async () => {
    if (!selectedId) return;
    setSheets(await Promise.all(days.map((date) => nursingService.getAdministrations(selectedId, date))));
    await onChanged();
  };

  const openMotif = (dose: MedicationAdministration, medication: string, mode: MotifMode) => {
    setReasonType('patient_refused');
    setReason(mode === 'correct' ? doseMotif(dose) : '');
    setMotif({ dose, medication, mode });
  };

  const confirmOnTime = async (dose: MedicationAdministration) => {
    if (!canConfirm(dose)) return;
    try {
      await nursingService.confirmAdministration(dose.id);
      toast({ title: 'Administration enregistrée', description: 'Date, heure et infirmier sont conservés dans l’historique.' });
      await reloadSheet();
    } catch (error) {
      toast({ title: 'Administration impossible', description: apiMessage(error), variant: 'destructive' });
    }
  };

  const saveMotif = async () => {
    if (!motif || reason.trim().length < 3) return;
    const text = reason.trim();
    setSavingMotif(true);
    try {
      if (motif.mode === 'late' && !isClosed(motif.dose)) {
        await nursingService.confirmAdministration(motif.dose.id, { reason: text });
        toast({ title: 'Prise en retard enregistrée', description: 'Le médecin et l’administrateur voient le motif sur la feuille.' });
      } else if (motif.mode === 'missed') {
        const full = `${reasonLabels[reasonType]} — ${text}`.slice(0, 500);
        await nursingService.markAdministrationMissed(motif.dose.id, { reasonType, reason: full });
        toast({ title: 'Prise non effectuée', description: 'Le médecin et l’administrateur voient le motif sur la feuille.' });
      } else {
        const missed = motif.dose.status === 'not_administered' || motif.dose.status === 'patient_refused';
        await nursingService.correctAdministration(motif.dose.id, missed ? { reason: text, notDoneReason: text } : { reason: text, observations: text });
        toast({ title: 'Motif enregistré', description: 'La correction reste dans l’historique. Le médecin et l’administrateur voient le motif.' });
      }
      setMotif(null);
      setReason('');
      await reloadSheet();
    } catch (error) {
      toast({ title: 'Motif non enregistré', description: apiMessage(error), variant: 'destructive' });
    } finally {
      setSavingMotif(false);
    }
  };

  const changeNewFrequency = (value: string) => {
    setNewTimes(value);
    setFirstDose(defaultFirstDose[value] ?? '06:00');
  };

  const addLine = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !newMedication.trim()) return;
    setAdding(true);
    try {
      await nursingService.addTreatmentLine({
        patientId: selectedId,
        medication: newMedication.trim(),
        timesPerDay: Number(newTimes),
        administrationRoute: newRoute,
        treatmentStartDate: days[0],
        treatmentEndDate: days[6],
        scheduleMode: 'automatic',
        firstDoseTime: firstDose,
      });
      setNewMedication('');
      toast({ title: 'Ligne ajoutée', description: 'Une ligne et ses cases ont été créées pour ce produit.' });
      await reloadSheet();
      addFormRef.current?.scrollIntoView({ block: 'end' });
    } catch (error) {
      toast({ title: 'Ligne non ajoutée', description: apiMessage(error), variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const openSchedule = (row: { id: string; prescriptionId: string; medication: string; route: string; times: string[]; start?: string; end?: string }) => {
    const count = String(Math.min(4, Math.max(1, row.times.length || 1)));
    const first = row.times[0] || defaultFirstDose[count];
    const knownRoute = (administrationRoutes as readonly string[]).includes(row.route) ? row.route : 'Orale';
    const automatic = previewTimes({ timesPerDay: Number(count), mode: 'automatic', firstDose: first, windowStart: '06:00', windowEnd: '18:00', customTimes: [] });
    const custom = row.times.length > 0 && automatic.times.join(',') !== [...row.times].sort().join(',');
    setScheduleDraft({
      rowId: row.id,
      prescriptionId: row.prescriptionId,
      medication: row.medication,
      route: knownRoute,
      timesPerDay: count,
      mode: custom ? 'custom' : 'automatic',
      firstDose: first,
      windowStart: '06:00',
      windowEnd: '18:00',
      customTimes: row.times.length ? [...row.times].sort() : automatic.times,
      startDate: row.start || days[0],
      endDate: row.end || days[6],
    });
  };

  const saveSchedule = async () => {
    if (!scheduleDraft || !selectedId) return;
    const preview = previewTimes({ ...scheduleDraft, timesPerDay: Number(scheduleDraft.timesPerDay) });
    if (preview.error) {
      toast({ title: 'Horaires incomplets', description: preview.error, variant: 'destructive' });
      return;
    }
    setSchedulingId(scheduleDraft.rowId);
    try {
      await nursingService.scheduleAdministrations({
        patientId: selectedId,
        prescriptionId: scheduleDraft.prescriptionId,
        prescriptionItemId: scheduleDraft.rowId,
        timesPerDay: Number(scheduleDraft.timesPerDay),
        administrationRoute: scheduleDraft.route,
        treatmentStartDate: scheduleDraft.startDate,
        treatmentEndDate: scheduleDraft.endDate,
        scheduleMode: scheduleDraft.mode,
        firstDoseTime: scheduleDraft.firstDose,
        windowStart: scheduleDraft.windowStart,
        windowEnd: scheduleDraft.windowEnd,
        ...(scheduleDraft.mode === 'custom' ? { administrationTimes: preview.times } : {}),
      });
      setScheduleDraft(null);
      toast({ title: 'Heures recalculées', description: 'Les prises déjà confirmées restent inchangées.' });
      await reloadSheet();
    } catch (error) {
      toast({ title: 'Horaires non enregistrés', description: apiMessage(error), variant: 'destructive' });
    } finally {
      setSchedulingId('');
    }
  };

  const printSheet = () => {
    const patient = patients.find((item) => item.id === selectedId);
    const title = patient ? `${patient.firstName} ${patient.lastName}` : 'Patient';
    const body = rows.map((row) => `<tr>
      <td>${escapeHtml(row.medication)}<br><small>${escapeHtml(row.dose)}</small></td>
      <td>${escapeHtml(frequencyLabel(row.times))}</td>
      <td>${escapeHtml(row.route)}</td>
      ${row.cells.map((cell) => `<td>${cell.map((dose) => `${clock(dose.scheduledAt)} ${escapeHtml(statusLabels[dose.status])}${dose.administeredByName ? ` · ${escapeHtml(dose.administeredByName)}` : ''}${doseMotif(dose) ? ` · ${escapeHtml(doseMotif(dose))}` : ''}`).join('<br>') || '—'}</td>`).join('')}
    </tr>`).join('');
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>Feuille de traitement · ${escapeHtml(title)}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #222;padding:6px;vertical-align:top}th{background:#f3f4f6}</style>
      </head><body><h1>Feuille de traitement</h1><p>${escapeHtml(title)} · ${escapeHtml(patient?.room ?? 'chambre non renseignée')} · ${escapeHtml(patient?.doctor ?? 'médecin non renseigné')}</p>
      <p>Semaine du ${escapeHtml(dayLabel(days[0]))} au ${escapeHtml(dayLabel(days[6]))}</p>
      <table><thead><tr><th rowspan="2">Médicaments</th><th rowspan="2">FREQ.</th><th rowspan="2">V.A</th><th colspan="7">JOURS &amp; HEURES PRÉCISES</th></tr>
      <tr>${days.map((date, index) => `<th>J${index + 1}<br>${escapeHtml(dayLabel(date))}</th>`).join('')}</tr></thead><tbody>${body || '<tr><td colspan="10">Aucun médicament prescrit sur cette période.</td></tr>'}</tbody></table></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const exportSheet = () => {
    const lines = [['Médicament', 'Dose', 'Fréquence', 'Voie', 'Jour', 'Heure', 'Statut', 'Infirmier', 'Heure réelle', 'Motif']];
    for (const row of rows) {
      row.cells.forEach((cell, index) => {
        for (const dose of cell) {
          lines.push([
            row.medication, row.dose, frequencyLabel(row.times), row.route,
            `J${index + 1} ${days[index]}`, clock(dose.scheduledAt), statusLabels[dose.status],
            dose.administeredByName ?? '', dose.administeredAt ? clock(dose.administeredAt) : '', doseMotif(dose),
          ]);
        }
      });
    }
    const csv = lines.map((line) => line.map((value) => `"${value.split('"').join('""')}"`).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `feuille-traitement-${weekStart}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const patient = patients.find((item) => item.id === selectedId);

  return (
    <Card>
      <CardHeader className="gap-3 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Feuille de traitement</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Prescriptions validées du dossier. Chaque case confirme une administration et conserve l’infirmier, la date et l’heure.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button type="button" variant="outline" onClick={printSheet} disabled={!rows.length}><Printer className="mr-2 h-4 w-4" />Imprimer</Button>
            <Button type="button" variant="outline" onClick={exportSheet} disabled={!rows.length}>Exporter</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Patient</Label>
            <PatientSelect patients={patients} value={selectedId} onValueChange={onSelectPatient} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="treatment-week">Premier jour (J1)</Label>
            <Input id="treatment-week" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>Semaine précédente</Button>
            <Button type="button" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>Semaine suivante</Button>
          </div>
        </div>
        {patient && (
          <p className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{patient.firstName} {patient.lastName}{patient.age !== undefined ? ` · ${patient.age} ans` : ''}</span>
            <span>{patient.ward ?? 'Service non renseigné'}</span>
            <span>Chambre {patient.room ?? '—'}</span>
            <span>{patient.doctor ?? 'Médecin non renseigné'}</span>
            {detail?.patient.allergies?.length ? <span>Allergies : {detail.patient.allergies.join(', ')}</span> : null}
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline" className="border-green-600 text-green-800"><CheckCircle2 className="mr-1 h-3 w-3" />{counts.done} effectué(s)</Badge>
          <Badge variant="outline" className="border-amber-500 text-amber-800"><Clock3 className="mr-1 h-3 w-3" />{counts.late} en retard</Badge>
          <Badge variant="outline" className="border-red-600 text-red-800"><XCircle className="mr-1 h-3 w-3" />{counts.missed} non effectué(s)</Badge>
          <span className="inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white">Jours restants</span>
          <span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">Traitement terminé</span>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Chargement de la feuille…</p>}
        {!loading && rows.length === 0 && <p className="rounded-lg border px-3 py-8 text-center text-sm text-muted-foreground">Aucune prescription validée pour cette semaine.</p>}
        <div className="space-y-3 lg:hidden">
          {rows.length > 0 && todayIndex < 0 && <p className="text-sm text-muted-foreground">Aujourd’hui n’est pas dans la semaine affichée.</p>}
          {todayIndex >= 0 && rows.map((row) => {
            const cell = row.cells[todayIndex] ?? [];
            const cue = treatmentCue(row.start, row.end, row.status);
            const dueToday = dayStillDue(days[todayIndex], row.start, row.end, row.status);
            return (
              <article key={row.id} className={`space-y-3 rounded-lg border p-3 ${cue?.tone === 'done' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' : dueToday ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40' : ''}`}>
                <div>
                  <p className="font-medium" title={row.medication}>{row.medication}</p>
                  <p className="text-xs text-muted-foreground">{row.dose}</p>
                  <p className="mt-1 text-sm">{frequencyLabel(row.times)} · {row.route || '—'}</p>
                  {cue && <p className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cue.className}`}>{cue.label}</p>}
                  {canWrite && <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => openSchedule(row)}>{row.times.length ? 'Modifier les heures' : 'Définir les heures'}</Button>}
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <p className="mb-2 text-xs font-medium">Aujourd’hui · J{todayIndex + 1} · {dayLabel(days[todayIndex])}</p>
                  {cell.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  <div className="space-y-2">
                    {cell.map((dose) => (
                      <DoseControls
                        key={dose.id}
                        dose={dose}
                        medication={row.medication}
                        day={days[todayIndex]}
                        canWrite={canWrite}
                        shown={Boolean(shownMotifs[dose.id])}
                        onToggle={() => setShownMotifs((current) => ({ ...current, [dose.id]: !current[dose.id] }))}
                        onOpen={(mode) => openMotif(dose, row.medication, mode)}
                        onConfirm={() => void confirmOnTime(dose)}
                      />
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto rounded-lg border lg:block">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="border px-2 py-2 text-left" rowSpan={2}>Médicaments</th>
                <th className="border px-2 py-2 text-left" rowSpan={2}>FREQ.</th>
                <th className="border px-2 py-2 text-left" rowSpan={2}>V.A</th>
                <th className="border px-2 py-2 text-center" colSpan={7}>JOURS & HEURES PRÉCISES</th>
              </tr>
              <tr>
                {days.map((date, index) => (
                  <th key={date} className="border px-2 py-2 text-center font-medium">J{index + 1}<br /><span className="text-xs font-normal text-muted-foreground">{dayLabel(date)}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const cue = treatmentCue(row.start, row.end, row.status);
                return (
                <tr key={row.id} className="align-top">
                  <td className={`max-w-[220px] border px-2 py-2 ${cue?.tone === 'done' ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}>
                    <p className="line-clamp-4 font-medium" title={row.medication}>{row.medication}</p>
                    <p className="text-xs text-muted-foreground">{row.dose}</p>
                    {cue && <p className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cue.className}`}>{cue.label}</p>}
                  </td>
                  <td className="border px-2 py-2 whitespace-nowrap">
                    <p>{frequencyLabel(row.times)}</p>
                    {canWrite && <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => openSchedule(row)}>{row.times.length ? 'Modifier les heures' : 'Définir les heures'}</Button>}
                  </td>
                  <td className="border px-2 py-2">{row.route || '—'}</td>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.id}-${days[index]}`} className={`border px-2 py-2 ${dayStillDue(days[index], row.start, row.end, row.status) ? 'bg-amber-100 dark:bg-amber-950/50' : ''}`}>
                      <div className="space-y-2">
                        {cell.map((dose) => (
                          <DoseControls
                            key={dose.id}
                            dose={dose}
                            medication={row.medication}
                            day={days[index]}
                            canWrite={canWrite}
                            shown={Boolean(shownMotifs[dose.id])}
                            onToggle={() => setShownMotifs((current) => ({ ...current, [dose.id]: !current[dose.id] }))}
                            onOpen={(mode) => openMotif(dose, row.medication, mode)}
                            onConfirm={() => void confirmOnTime(dose)}
                          />
                        ))}
                        {cell.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                  ))}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canWrite && selectedId && (
          <form ref={addFormRef} onSubmit={addLine} className="flex flex-nowrap items-end gap-2 overflow-x-auto rounded-lg border p-3">
            <div className="min-w-[12rem] flex-1 space-y-2">
              <Label htmlFor="new-product">Médicament</Label>
              <Input id="new-product" value={newMedication} maxLength={160} placeholder="Nom du produit" onChange={(event) => setNewMedication(event.target.value)} required />
            </div>
            <div className="w-40 shrink-0 space-y-2">
              <Label>Fréquence</Label>
              <Select value={newTimes} onValueChange={changeNewFrequency}>
                <SelectTrigger aria-label="Fréquence du nouveau produit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 fois / jour</SelectItem>
                  <SelectItem value="2">2 fois / jour</SelectItem>
                  <SelectItem value="3">3 fois / jour</SelectItem>
                  <SelectItem value="4">4 fois / jour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-44 shrink-0 space-y-2">
              <Label>Voie</Label>
              <Select value={newRoute} onValueChange={setNewRoute}>
                <SelectTrigger aria-label="Voie du nouveau produit"><SelectValue /></SelectTrigger>
                <SelectContent>{administrationRoutes.map((route) => <SelectItem key={route} value={route}>{route}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" className="shrink-0" disabled={adding || !newMedication.trim()}>{adding ? 'Ajout...' : 'Ajouter la ligne'}</Button>
          </form>
        )}
        <p className="text-xs text-muted-foreground">La case s’ouvre 2 heures avant l’heure prévue. L’heure atteinte ne valide pas la prise. Case verte : confirmée à l’heure. Case jaune : en retard, à confirmer ou déjà confirmée avec un motif. Case rouge : prise non effectuée. Le médecin et l’administrateur voient ces motifs.</p>
        <Dialog open={scheduleDraft !== null} onOpenChange={(open) => { if (!open && !schedulingId) setScheduleDraft(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Horaires de {scheduleDraft?.medication}</DialogTitle>
              <DialogDescription>Les heures sont recalculées selon la fréquence. Les prises déjà confirmées ne sont pas modifiées.</DialogDescription>
            </DialogHeader>
            {scheduleDraft && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fréquence</Label>
                    <Select value={scheduleDraft.timesPerDay} onValueChange={(value) => {
                      const first = defaultFirstDose[value] ?? scheduleDraft.firstDose;
                      const next = previewTimes({ timesPerDay: Number(value), mode: 'automatic', firstDose: first, windowStart: scheduleDraft.windowStart, windowEnd: scheduleDraft.windowEnd, customTimes: [] });
                      setScheduleDraft({ ...scheduleDraft, timesPerDay: value, firstDose: first, customTimes: next.times.length ? next.times : [first] });
                    }}>
                      <SelectTrigger aria-label="Fréquence à recalculer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 fois / jour</SelectItem>
                        <SelectItem value="2">2 fois / jour</SelectItem>
                        <SelectItem value="3">3 fois / jour</SelectItem>
                        <SelectItem value="4">4 fois / jour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Voie</Label>
                    <Select value={scheduleDraft.route} onValueChange={(route) => setScheduleDraft({ ...scheduleDraft, route })}>
                      <SelectTrigger aria-label="Voie d’administration"><SelectValue /></SelectTrigger>
                      <SelectContent>{administrationRoutes.map((route) => <SelectItem key={route} value={route}>{route}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={Boolean(schedulingId)} onClick={() => setScheduleDraft(null)}>Annuler</Button>
              <Button type="button" disabled={Boolean(schedulingId)} onClick={() => void saveSchedule()}>{schedulingId ? 'Enregistrement...' : 'Recalculer'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={motif !== null} onOpenChange={(open) => { if (!open && !savingMotif) { setMotif(null); setReason(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{motif?.mode === 'missed' ? 'Prise non effectuée' : motif?.mode === 'correct' ? 'Corriger le motif' : 'Motif du retard'}</DialogTitle>
              <DialogDescription>
                {motif ? `${motif.medication} · prévu à ${clock(motif.dose.scheduledAt)}. ` : ''}
                Ce texte reste sur la feuille de traitement. Le médecin et l’administrateur peuvent le lire.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {motif?.mode === 'missed' && (
                <div className="space-y-2">
                  <Label htmlFor="motif-type">Type de motif</Label>
                  <Select value={reasonType} onValueChange={(value) => setReasonType(value as ReasonType)}>
                    <SelectTrigger id="motif-type" aria-label="Type de motif"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(reasonLabels) as ReasonType[]).map((key) => <SelectItem key={key} value={key}>{reasonLabels[key]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="administration-motif">Motif</Label>
                <Textarea id="administration-motif" value={reason} maxLength={500} rows={4} placeholder={motif?.mode === 'late' ? 'Exemple : le patient était encore au bloc' : 'Décrivez ce qui s’est passé'} onChange={(event) => setReason(event.target.value)} />
                <p className="text-xs text-muted-foreground">{reason.trim().length}/500 · 3 caractères minimum.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={savingMotif} onClick={() => { setMotif(null); setReason(''); }}>Annuler</Button>
              <Button type="button" variant={motif?.mode === 'missed' ? 'destructive' : 'default'} disabled={savingMotif || reason.trim().length < 3} onClick={() => void saveMotif()}>{savingMotif ? 'Enregistrement...' : 'Enregistrer le motif'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
