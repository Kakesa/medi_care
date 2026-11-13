import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Clock3, Printer, X, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiMessage } from '@/lib/apiError';
import { useToast } from '@/hooks/use-toast';
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

function frequencyLabel(times: string[]) {
  if (times.length === 1) return '1 fois / jour';
  if (times.length > 1) return `${times.length} fois / jour`;
  return '—';
}

function doseTone(dose: MedicationAdministration) {
  if (dose.status === 'administered_on_time') return 'green';
  if (dose.status === 'administered_late') return 'yellow';
  if (dose.status === 'not_administered' || dose.status === 'patient_refused') return 'red';
  if (!isClosed(dose) && new Date(dose.scheduledAt).getTime() + 60 * 60_000 < Date.now()) return 'red';
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

function canConfirm(dose: MedicationAdministration) {
  if (isClosed(dose)) return false;
  return new Date(dose.scheduledAt).getTime() <= Date.now();
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
  const [missedId, setMissedId] = useState('');
  const [reasonType, setReasonType] = useState<ReasonType>('patient_refused');
  const [reason, setReason] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { times: string; route: string }>>({});
  const [schedulingId, setSchedulingId] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [newTimes, setNewTimes] = useState('1');
  const [newRoute, setNewRoute] = useState('Orale');
  const [adding, setAdding] = useState(false);
  const addFormRef = useRef<HTMLFormElement>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

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
    const grouped = new Map<string, { id: string; prescriptionId: string; medication: string; dose: string; route: string; posology: string; times: string[]; cells: MedicationAdministration[][] }>();
    for (const dose of doses) {
      const current = grouped.get(dose.prescriptionItemId) ?? {
        id: dose.prescriptionItemId,
        prescriptionId: dose.prescriptionId,
        medication: dose.medication,
        dose: dose.prescribedDose,
        route: dose.administrationRoute,
        posology: dose.posology,
        times: [],
        cells: days.map(() => []),
      };
      current.cells[dose.dayIndex]?.push(dose);
      const time = clock(dose.scheduledAt);
      if (!current.times.includes(time)) current.times.push(time);
      grouped.set(dose.prescriptionItemId, current);
    }
    for (const prescription of detail?.prescriptions ?? []) {
      for (const item of prescription.items) {
        if (grouped.has(item.id)) continue;
        const start = item.treatmentStartDate;
        const end = item.treatmentEndDate;
        const overlaps = !start || !end || !(end < days[0] || start > days[6]);
        if (!overlaps) continue;
        grouped.set(item.id, {
          id: item.id,
          prescriptionId: prescription.id,
          medication: item.medication,
          dose: item.dosage,
          route: item.administrationRoute || '',
          posology: item.posology,
          times: item.administrationTimes ?? [],
          cells: days.map(() => []),
        });
      }
    }
    return [...grouped.values()].sort((a, b) => a.medication.localeCompare(b.medication, 'fr'));
  }, [doses, detail?.prescriptions, days]);

  const unconfigured = useMemo(() => {
    const seen = new Set<string>();
    return sheets.flatMap((sheet) => sheet.unconfiguredItems).filter((item) => {
      const key = `${item.prescriptionId}:${item.medication}:${item.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [sheets]);

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

  const confirm = async (dose: MedicationAdministration) => {
    if (!canConfirm(dose)) return;
    try {
      await nursingService.confirmAdministration(dose.id);
      toast({ title: 'Administration enregistrée', description: 'Date, heure et infirmier sont conservés dans l’historique.' });
      await reloadSheet();
    } catch (error) {
      toast({ title: 'Administration impossible', description: apiMessage(error), variant: 'destructive' });
    }
  };

  const markMissed = async (dose: MedicationAdministration) => {
    if (!reason.trim()) return;
    try {
      await nursingService.markAdministrationMissed(dose.id, { reasonType, reason: reason.trim() });
      setMissedId('');
      setReason('');
      toast({ title: 'Prise non effectuée', description: 'Le motif est historisé. Une administration validée ne se modifie pas sans correction justifiée.' });
      await reloadSheet();
    } catch (error) {
      toast({ title: 'Enregistrement impossible', description: apiMessage(error), variant: 'destructive' });
    }
  };

  const correct = async (dose: MedicationAdministration) => {
    const justification = window.prompt('Justification obligatoire. Une administration validée n’est pas modifiée sans trace.')?.trim();
    if (!justification) return;
    const observations = window.prompt('Observation corrigée', dose.observations ?? '');
    if (observations === null) return;
    try {
      await nursingService.correctAdministration(dose.id, { reason: justification, observations });
      toast({ title: 'Correction tracée' });
      await reloadSheet();
    } catch (error) {
      toast({ title: 'Correction impossible', description: apiMessage(error), variant: 'destructive' });
    }
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

  const applySchedule = async (row: { id: string; prescriptionId: string }) => {
    const draft = drafts[row.id] ?? { times: '1', route: 'Orale' };
    if (!selectedId) return;
    setSchedulingId(row.id);
    try {
      await nursingService.scheduleAdministrations({
        patientId: selectedId,
        prescriptionId: row.prescriptionId,
        prescriptionItemId: row.id,
        timesPerDay: Number(draft.times),
        administrationRoute: draft.route,
        treatmentStartDate: days[0],
        treatmentEndDate: days[6],
      });
      toast({ title: 'Cases ajoutées', description: `${draft.times} prise(s) par jour sur cette semaine.` });
      await reloadSheet();
    } catch (error) {
      toast({ title: 'Fréquence non enregistrée', description: apiMessage(error), variant: 'destructive' });
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
      ${row.cells.map((cell) => `<td>${cell.map((dose) => `${clock(dose.scheduledAt)} ${escapeHtml(statusLabels[dose.status])}${dose.administeredByName ? ` · ${escapeHtml(dose.administeredByName)}` : ''}`).join('<br>') || '—'}</td>`).join('')}
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
    const lines = [['Médicament', 'Dose', 'Fréquence', 'Voie', 'Jour', 'Heure', 'Statut', 'Infirmier', 'Heure réelle']];
    for (const row of rows) {
      row.cells.forEach((cell, index) => {
        for (const dose of cell) {
          lines.push([
            row.medication, row.dose, frequencyLabel(row.times), row.route,
            `J${index + 1} ${days[index]}`, clock(dose.scheduledAt), statusLabels[dose.status],
            dose.administeredByName ?? '', dose.administeredAt ? clock(dose.administeredAt) : '',
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
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Feuille de traitement</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Prescriptions validées du dossier. Chaque case confirme une administration et conserve l’infirmier, la date et l’heure.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={printSheet} disabled={!rows.length}><Printer className="mr-2 h-4 w-4" />Imprimer</Button>
            <Button type="button" variant="outline" onClick={exportSheet} disabled={!rows.length}>Exporter</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Patient</Label>
            <Select value={selectedId || undefined} onValueChange={onSelectPatient}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un patient" /></SelectTrigger>
              <SelectContent>{patients.map((item) => <SelectItem key={item.id} value={item.id}>{item.firstName} {item.lastName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="treatment-week">Premier jour (J1)</Label>
            <Input id="treatment-week" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
          </div>
          <div className="flex items-end gap-2 text-sm text-muted-foreground">
            <Button type="button" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>Semaine précédente</Button>
            <Button type="button" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>Semaine suivante</Button>
          </div>
        </div>
        {patient && (
          <p className="text-sm text-muted-foreground">
            {patient.firstName} {patient.lastName}{patient.age !== undefined ? ` · ${patient.age} ans` : ''} · {patient.ward ?? 'Service non renseigné'} · Chambre {patient.room ?? '—'} · {patient.doctor ?? 'Médecin non renseigné'}
            {detail?.patient.allergies?.length ? ` · Allergies : ${detail.patient.allergies.join(', ')}` : ''}
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline" className="border-green-600 text-green-800"><CheckCircle2 className="mr-1 h-3 w-3" />{counts.done} effectué(s)</Badge>
          <Badge variant="outline" className="border-amber-500 text-amber-800"><Clock3 className="mr-1 h-3 w-3" />{counts.late} en retard</Badge>
          <Badge variant="outline" className="border-red-600 text-red-800"><XCircle className="mr-1 h-3 w-3" />{counts.missed} non effectué(s)</Badge>
        </div>
        {unconfigured.length > 0 && canWrite && (
          <p className="text-sm text-amber-700">Choisissez la fréquence et la voie. Une prise par jour affiche une case, deux prises en affichent deux, et ainsi de suite.</p>
        )}
        <div className="overflow-x-auto rounded-lg border">
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
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="max-w-[220px] border px-2 py-2">
                    <p className="line-clamp-4 font-medium" title={row.medication}>{row.medication}</p>
                    <p className="text-xs text-muted-foreground">{row.dose}</p>
                  </td>
                  <td className="border px-2 py-2 whitespace-nowrap">
                    {row.times.length === 0 && canWrite ? (
                      <Select value={drafts[row.id]?.times ?? '1'} onValueChange={(value) => setDrafts((current) => ({ ...current, [row.id]: { times: value, route: current[row.id]?.route ?? 'Orale' } }))}>
                        <SelectTrigger className="h-8 w-36" aria-label={`Fréquence de ${row.medication}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 fois / jour</SelectItem>
                          <SelectItem value="2">2 fois / jour</SelectItem>
                          <SelectItem value="3">3 fois / jour</SelectItem>
                          <SelectItem value="4">4 fois / jour</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : frequencyLabel(row.times)}
                  </td>
                  <td className="border px-2 py-2">
                    {row.times.length === 0 && canWrite ? (
                      <div className="space-y-2">
                        <Select value={drafts[row.id]?.route ?? 'Orale'} onValueChange={(value) => setDrafts((current) => ({ ...current, [row.id]: { times: current[row.id]?.times ?? '1', route: value } }))}>
                          <SelectTrigger className="h-8 w-40" aria-label={`Voie de ${row.medication}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{administrationRoutes.map((route) => <SelectItem key={route} value={route}>{route}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button type="button" size="sm" disabled={schedulingId === row.id} onClick={() => void applySchedule(row)}>Afficher les cases</Button>
                      </div>
                    ) : (row.route || '—')}
                  </td>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.id}-${days[index]}`} className="border px-2 py-2">
                      <div className="space-y-2">
                        {cell.map((dose) => {
                          const closed = isClosed(dose);
                          const checked = dose.status === 'administered_on_time' || dose.status === 'administered_late';
                          const tone = doseTone(dose);
                          const toneClass = tone === 'green'
                            ? 'border-green-700 bg-green-600 text-white'
                            : tone === 'yellow'
                              ? 'border-amber-600 bg-amber-400 text-amber-950'
                              : tone === 'red'
                                ? 'border-red-700 bg-red-600 text-white'
                                : 'border-slate-400 bg-white text-transparent';
                          return (
                            <div key={dose.id} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!canWrite || !canConfirm(dose)}
                                  aria-label={`${row.medication} ${clock(dose.scheduledAt)} ${days[index]}`}
                                  title={tone === 'green' ? 'Pris à l’heure' : tone === 'yellow' ? 'Pris en retard' : tone === 'red' ? 'Prise ratée' : 'À administrer'}
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${toneClass} disabled:cursor-not-allowed`}
                                  onClick={() => void confirm(dose)}
                                >
                                  {tone === 'red' ? <X className="h-4 w-4" /> : tone === 'open' ? null : <Check className="h-4 w-4" />}
                                </button>
                                <span className="text-xs">{clock(dose.scheduledAt)}</span>
                              </div>
                              {dose.administeredByName && <p className="text-[11px] text-muted-foreground">{dose.administeredByName} · {dose.administeredAt ? clock(dose.administeredAt) : ''}</p>}
                              {dose.notDoneReason && <p className="text-[11px] text-red-700">{dose.notDoneReason}</p>}
                              {canWrite && canConfirm(dose) && (
                                <button type="button" className="text-[11px] text-destructive underline" onClick={() => { setMissedId(dose.id); setReason(''); }}>Non effectué</button>
                              )}
                              {canWrite && closed && (checked || dose.status === 'not_administered' || dose.status === 'patient_refused') && (
                                <button type="button" className="block text-[11px] text-muted-foreground underline" onClick={() => void correct(dose)}>Corriger avec motif</button>
                              )}
                              {missedId === dose.id && (
                                <div className="space-y-1">
                                  <Select value={reasonType} onValueChange={(value) => setReasonType(value as ReasonType)}>
                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="patient_refused">Refus du patient</SelectItem>
                                      <SelectItem value="patient_absent">Patient absent</SelectItem>
                                      <SelectItem value="unavailable">Médicament indisponible</SelectItem>
                                      <SelectItem value="other">Autre motif</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input className="h-8" placeholder="Motif obligatoire" value={reason} onChange={(event) => setReason(event.target.value)} />
                                  <Button type="button" size="sm" variant="destructive" disabled={!reason.trim()} onClick={() => void markMissed(dose)}>Enregistrer</Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {cell.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Aucune prescription validée pour cette semaine.</td></tr>
              )}
              {loading && <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Chargement de la feuille…</td></tr>}
            </tbody>
          </table>
        </div>
        {canWrite && selectedId && (
          <form ref={addFormRef} onSubmit={addLine} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_11rem_12rem_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="new-product">Médicament</Label>
              <Input id="new-product" value={newMedication} maxLength={160} placeholder="Nom du produit" onChange={(event) => setNewMedication(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Fréquence</Label>
              <Select value={newTimes} onValueChange={setNewTimes}>
                <SelectTrigger aria-label="Fréquence du nouveau produit"><SelectValue /></SelectTrigger>
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
              <Select value={newRoute} onValueChange={setNewRoute}>
                <SelectTrigger aria-label="Voie du nouveau produit"><SelectValue /></SelectTrigger>
                <SelectContent>{administrationRoutes.map((route) => <SelectItem key={route} value={route}>{route}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={adding || !newMedication.trim()}>{adding ? 'Ajout...' : 'Ajouter la ligne'}</Button>
          </form>
        )}
        <p className="text-xs text-muted-foreground">Case verte : pris à l’heure. Case jaune : pris en retard. Case rouge : prise ratée. Une case validée ne se décoche pas sans une correction justifiée.</p>
      </CardContent>
    </Card>
  );
}
