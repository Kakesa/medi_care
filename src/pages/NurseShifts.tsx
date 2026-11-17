import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { shiftService, type NurseShift, type ShiftCycle, type ShiftTemplate } from '@/services/shiftService';

const legacyNames: Record<string, string> = {
  morning: 'Matin',
  afternoon: 'Après-midi',
  night: 'Nuit',
  full_day: 'Journée',
};
const examples = [
  { name: 'Garde 24 h', start: '07:00', end: '07:00' },
  { name: 'Journée', start: '06:00', end: '18:00' },
  { name: 'Nuit', start: '18:00', end: '06:00' },
  { name: 'Matin', start: '06:00', end: '14:00' },
  { name: 'Après-midi', start: '14:00', end: '22:00' },
  { name: 'Nuit courte', start: '22:00', end: '06:00' },
];
const cycleExamples = [
  { name: 'Rotation après 24 h', work: '1', rest: '1' },
  { name: '2 jours / 2 repos', work: '2', rest: '2' },
  { name: '3 jours / 3 repos', work: '3', rest: '3' },
  { name: '1 semaine / 1 semaine', work: '7', rest: '7' },
];

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
function dayLabel(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
function typeName(value: string) {
  return legacyNames[value] ?? value;
}
function durationLabel(start: string, end: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!rest) return hours === 1 ? '1 heure' : `${hours} heures`;
  return `${hours} h ${String(rest).padStart(2, '0')}`;
}
function apiMessage(reason: unknown) {
  if (typeof reason === 'object' && reason && 'message' in reason && typeof reason.message === 'string') return reason.message;
  return 'Réessayez dans un instant.';
}

type Slot = { date: string; name: string; startTime: string; endTime: string; ward: string; requiredNurses: number };

export default function NurseShifts() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [cycles, setCycles] = useState<ShiftCycle[]>([]);
  const [shifts, setShifts] = useState<NurseShift[]>([]);
  const [from, setFrom] = useState(today());
  const [span, setSpan] = useState<'week' | 'month'>('week');
  const [templateId, setTemplateId] = useState('');
  const [cycleId, setCycleId] = useState('custom');
  const [rotation24, setRotation24] = useState(true);
  const [workDays, setWorkDays] = useState('1');
  const [restDays, setRestDays] = useState('1');
  const [selected, setSelected] = useState<string[]>([]);
  const [targetFrom, setTargetFrom] = useState(addDays(today(), 7));
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slotNurses, setSlotNurses] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [replacement, setReplacement] = useState('');
  const [form, setForm] = useState({ id: '', name: '', startTime: '07:00', endTime: '07:00', ward: 'Soins infirmiers', requiredNurses: '1' });
  const [cycleForm, setCycleForm] = useState({ id: '', name: '', workDays: '1', restDays: '1' });

  const to = addDays(from, span === 'week' ? 6 : 29);
  const days = useMemo(() => Array.from({ length: span === 'week' ? 7 : 30 }, (_, index) => addDays(from, index)), [from, span]);
  const template = templates.find((item) => item.id === templateId) ?? templates.find((item) => item.active);

  const loadShifts = useCallback(() => {
    shiftService.list(from, to).then(setShifts).catch((error) => {
      toast({ title: 'Planning indisponible', description: apiMessage(error), variant: 'destructive' });
    });
  }, [from, to, toast]);

  const loadConfig = useCallback(() => {
    Promise.all([shiftService.templates(), shiftService.cycles(), shiftService.staff()]).then(([nextTemplates, nextCycles, nextStaff]) => {
      setTemplates(nextTemplates);
      setCycles(nextCycles);
      setStaff(nextStaff);
      setTemplateId((current) => current || nextTemplates.find((item) => item.active)?.id || '');
    }).catch((error) => {
      toast({ title: 'Configuration indisponible', description: apiMessage(error), variant: 'destructive' });
    });
  }, [toast]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadShifts(); }, [loadShifts]);

  const rows = useMemo(() => {
    const active = templates.filter((item) => item.active);
    const known = new Set(active.map((item) => `${item.name}|${item.startTime}`));
    const extras = shifts.filter((shift) => shift.status !== 'cancelled' && !known.has(`${shift.type}|${shift.startTime}`));
    const extraRows = extras.filter((shift, index) => extras.findIndex((item) => item.type === shift.type && item.startTime === shift.startTime) === index);
    return [
      ...active.map((item) => ({ name: item.name, startTime: item.startTime, endTime: item.endTime, ward: item.ward, requiredNurses: item.requiredNurses, durationLabel: item.durationLabel })),
      ...extraRows.map((shift) => ({ name: shift.type, startTime: shift.startTime, endTime: shift.endTime, ward: shift.ward, requiredNurses: 1, durationLabel: shift.durationLabel })),
    ];
  }, [templates, shifts]);

  const drafts = shifts.filter((shift) => shift.status === 'draft');
  const conflicts = shifts.filter((shift) => shift.conflict);

  const openSlot = (next: Slot) => {
    const assigned = shifts.filter((shift) => shift.date === next.date && shift.type === next.name && shift.startTime === next.startTime && shift.status !== 'cancelled').map((shift) => shift.nurseId);
    setSlot(next);
    setSlotNurses(assigned);
    setReason('');
    setReplacement('');
  };

  const saveSlot = async () => {
    if (!slot) return;
    const current = shifts.filter((shift) => shift.date === slot.date && shift.type === slot.name && shift.startTime === slot.startTime && shift.status !== 'cancelled');
    const adding = slotNurses.filter((id) => !current.some((shift) => shift.nurseId === id));
    const removing = current.filter((shift) => !slotNurses.includes(shift.nurseId) && shift.status !== 'in_progress' && shift.status !== 'completed');
    try {
      if (adding.length) {
        await shiftService.create({ nurseIds: adding, date: slot.date, startTime: slot.startTime, endTime: slot.endTime, type: slot.name, ward: slot.ward });
      }
      for (const shift of removing) {
        await shiftService.update(shift.id, { date: shift.date, startTime: shift.startTime, endTime: shift.endTime, type: shift.type, ward: shift.ward, status: 'cancelled' });
      }
      setSlot(null);
      toast({ title: 'Affectation enregistrée', description: 'Le brouillon n’est visible par les infirmiers qu’après publication.' });
      loadShifts();
    } catch (error) {
      toast({ title: 'Affectation impossible', description: apiMessage(error), variant: 'destructive' });
    }
  };

  const generate = async () => {
    if (!template || !selected.length) {
      toast({ title: 'Choisissez une garde et des infirmiers', variant: 'destructive' });
      return;
    }
    try {
      const handsOverAfter24h = rotation24;
      const dutyDays = handsOverAfter24h ? 1 : Number(workDays);
      const offDays = handsOverAfter24h ? Math.max(1, selected.length - 1) : Number(restDays);
      await shiftService.rotation({
        nurseIds: selected,
        from,
        to,
        workDays: dutyDays,
        restDays: offDays,
        startTime: template.startTime,
        endTime: handsOverAfter24h ? template.startTime : template.endTime,
        type: template.name,
        ward: template.ward,
      });
      toast({
        title: 'Brouillon généré',
        description: handsOverAfter24h
          ? 'Chaque infirmier tient la garde 24 h, puis le suivant prend la relève.'
          : 'Vérifiez le calendrier, puis publiez pour prévenir les infirmiers.',
      });
      loadShifts();
    } catch (error) {
      toast({ title: 'Rotation non générée', description: apiMessage(error), variant: 'destructive' });
    }
  };

  const publish = async () => {
    try {
      const published = await shiftService.publish(from, to);
      toast({ title: 'Planning publié', description: `${published.length} garde(s) notifiée(s) aux infirmiers.` });
      loadShifts();
    } catch (error) {
      toast({ title: 'Publication impossible', description: apiMessage(error), variant: 'destructive' });
    }
  };

  const copy = async () => {
    try {
      const result = await shiftService.copy(from, to, targetFrom);
      toast({
        title: 'Planning copié en brouillon',
        description: result.skipped.length
          ? `${result.created.length} garde(s) copiée(s). ${result.skipped.length} ignorée(s) pour conflit : ${result.skipped.slice(0, 3).map((item) => `${item.nurseName} le ${dayLabel(item.date)}`).join(', ')}.`
          : `${result.created.length} garde(s) copiée(s). Publiez-les après vérification.`,
      });
      setFrom(targetFrom);
    } catch (error) {
      toast({ title: 'Copie impossible', description: apiMessage(error), variant: 'destructive' });
    }
  };

  const saveTemplate = async () => {
    try {
      await shiftService.saveTemplate({
        name: form.name,
        startTime: form.startTime,
        endTime: form.endTime,
        ward: form.ward,
        requiredNurses: Number(form.requiredNurses),
      }, form.id || undefined);
      setForm({ id: '', name: '', startTime: '06:00', endTime: '18:00', ward: 'Soins infirmiers', requiredNurses: '1' });
      toast({ title: 'Type de garde enregistré' });
      loadConfig();
    } catch (error) {
      toast({ title: 'Enregistrement impossible', description: apiMessage(error), variant: 'destructive' });
    }
  };

  const saveCycle = async () => {
    try {
      await shiftService.saveCycle({ name: cycleForm.name, workDays: Number(cycleForm.workDays), restDays: Number(cycleForm.restDays) }, cycleForm.id || undefined);
      setCycleForm({ id: '', name: '', workDays: '2', restDays: '2' });
      toast({ title: 'Cycle enregistré' });
      loadConfig();
    } catch (error) {
      toast({ title: 'Enregistrement impossible', description: apiMessage(error), variant: 'destructive' });
    }
  };

  const slotShifts = slot ? shifts.filter((shift) => shift.date === slot.date && shift.type === slot.name && shift.startTime === slot.startTime && shift.status !== 'cancelled') : [];

  return (
    <div className="space-y-6">
      <div className="sticky top-16 z-20 -mx-4 border-b bg-background/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administration</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><CalendarClock className="h-6 w-6 text-primary" />Gardes infirmières</h1>
        <p className="mt-1 text-sm text-muted-foreground">La relève se fait après 24 h : un infirmier tient la garde, puis le suivant commence. Le brouillon n’est visible qu’après publication.</p>
      </div>

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">Calendrier</TabsTrigger>
          <TabsTrigger value="settings">Configuration des gardes</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <Card><CardContent className="grid gap-3 p-4 lg:grid-cols-4">
            <div className="space-y-2"><Label>Type de garde</Label>
              <Select value={template?.id} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Créer un type dans la configuration" /></SelectTrigger>
                <SelectContent>{templates.filter((item) => item.active).map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.startTime}–{item.endTime} · {item.durationLabel}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Cycle</Label>
              <Select value={rotation24 ? 'after-24h' : cycleId} onValueChange={(value) => {
                if (value === 'after-24h') {
                  setRotation24(true);
                  setCycleId('custom');
                  setWorkDays('1');
                  setRestDays(String(Math.max(1, selected.length - 1)));
                  return;
                }
                setRotation24(false);
                setCycleId(value);
                const cycle = cycles.find((item) => item.id === value);
                if (cycle) { setWorkDays(String(cycle.workDays)); setRestDays(String(cycle.restDays)); }
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="after-24h">Relève après 24 h</SelectItem>
                  <SelectItem value="custom">Personnalisé</SelectItem>
                  {cycles.map((cycle) => <SelectItem key={cycle.id} value={cycle.id}>{cycle.name} · {cycle.workDays}/{cycle.restDays}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2"><Label>Jours de garde</Label><Input type="number" min={1} max={31} value={rotation24 ? '1' : workDays} disabled={rotation24} onChange={(event) => { setRotation24(false); setCycleId('custom'); setWorkDays(event.target.value); }} /></div>
              <div className="space-y-2"><Label>Jours avant la relève</Label><Input type="number" min={1} max={31} value={rotation24 ? String(Math.max(1, selected.length - 1)) : restDays} disabled={rotation24} onChange={(event) => { setRotation24(false); setCycleId('custom'); setRestDays(event.target.value); }} /></div>
            </div>
            <div className="space-y-2">
              <Label>Infirmiers de la rotation</Label>
              <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                {staff.map((nurse) => (
                  <label key={nurse.id} className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs">
                    <input type="checkbox" checked={selected.includes(nurse.id)} onChange={() => setSelected((current) => current.includes(nurse.id) ? current.filter((id) => id !== nurse.id) : [...current, nurse.id])} />
                    {nurse.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="lg:col-span-4"><Button type="button" onClick={generate}>Générer le brouillon</Button></div>
          </CardContent></Card>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setFrom(addDays(from, span === 'week' ? -7 : -30))}>Période précédente</Button>
            <Button type="button" variant="outline" onClick={() => setSpan(span === 'week' ? 'month' : 'week')}>{span === 'week' ? 'Voir le mois' : 'Voir la semaine'}</Button>
            <p className="text-sm text-muted-foreground">{dayLabel(from)} – {dayLabel(to)}</p>
            <Button type="button" variant="outline" onClick={() => setFrom(addDays(from, span === 'week' ? 7 : 30))}>Période suivante</Button>
            <Button type="button" onClick={publish} disabled={!drafts.length}>Publier {drafts.length ? `(${drafts.length})` : ''}</Button>
            <Input className="w-40" type="date" value={targetFrom} onChange={(event) => setTargetFrom(event.target.value)} />
            <Button type="button" variant="outline" onClick={copy}>Copier vers cette date</Button>
          </div>

          {conflicts.length > 0 && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{conflicts.length} affectation(s) en conflit d’horaire. Le même infirmier ne peut pas tenir deux gardes qui se chevauchent.</p>}

          {span === 'week' ? (
            <div className="overflow-x-auto">
              <div className="grid min-w-[64rem] grid-cols-[12rem_repeat(7,minmax(0,1fr))] gap-2">
                <div />
                {days.map((date) => <p key={date} className="text-center text-sm font-medium capitalize">{dayLabel(date)}</p>)}
                {rows.map((row) => (
                  <div key={`${row.name}-${row.startTime}`} className="contents">
                    <div className="rounded-xl bg-muted/60 p-2 text-sm">
                      <p className="font-medium">{typeName(row.name)}</p>
                      <p className="text-muted-foreground">{row.startTime}–{row.endTime}</p>
                      <p className="text-muted-foreground">{row.durationLabel} · {row.requiredNurses} infirmier(s) · {row.ward}</p>
                    </div>
                    {days.map((date) => {
                      const cell = shifts.filter((shift) => shift.date === date && shift.type === row.name && shift.startTime === row.startTime && shift.status !== 'cancelled');
                      const short = cell.length < row.requiredNurses;
                      return (
                        <button key={date} type="button" onClick={() => openSlot({ date, name: row.name, startTime: row.startTime, endTime: row.endTime, ward: row.ward, requiredNurses: row.requiredNurses })} className={`min-h-24 rounded-xl border p-2 text-left ${short ? 'border-amber-300 bg-amber-50/60' : 'bg-card'}`}>
                          <p className="mb-1 text-[11px] text-muted-foreground">{cell.length}/{row.requiredNurses}</p>
                          {cell.map((shift) => (
                            <span key={shift.id} className={`mb-1 block truncate rounded-md px-1.5 py-0.5 text-xs ${shift.conflict ? 'bg-rose-100 text-rose-900' : shift.absent ? 'bg-amber-100 text-amber-950' : shift.status === 'draft' ? 'bg-sky-100 text-sky-950' : 'bg-teal-100 text-teal-950'}`}>
                              {shift.nurseName}{shift.absent ? ' · absence' : shift.status === 'draft' ? ' · brouillon' : ''}
                            </span>
                          ))}
                          {!cell.length && <span className="text-xs text-muted-foreground"><Plus className="mr-1 inline h-3 w-3" />Affecter</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
                <div className="rounded-xl bg-emerald-50 p-2 text-sm font-medium text-emerald-950">Repos</div>
                {days.map((date) => {
                  const working = new Set(shifts.filter((shift) => shift.date === date && shift.status !== 'cancelled').map((shift) => shift.nurseId));
                  const resting = staff.filter((nurse) => !working.has(nurse.id));
                  return <p key={date} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2 text-xs text-emerald-950">{resting.map((nurse) => nurse.name).join(', ') || '—'}</p>;
                })}
              </div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {days.map((date) => {
                const cell = shifts.filter((shift) => shift.date === date && shift.status !== 'cancelled');
                const absent = cell.filter((shift) => shift.absent).length;
                return (
                  <button key={date} type="button" onClick={() => { setFrom(date); setSpan('week'); }} className="rounded-xl border bg-card p-3 text-left">
                    <p className="text-sm font-medium capitalize">{dayLabel(date)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{cell.length} garde(s){absent ? ` · ${absent} absence(s)` : ''}</p>
                    {cell.slice(0, 4).map((shift) => <p key={shift.id} className={`truncate text-xs ${shift.conflict ? 'text-rose-700' : ''}`}>{typeName(shift.type)} · {shift.nurseName}</p>)}
                  </button>
                );
              })}
            </div>
          )}
          {!rows.length && <p className="text-sm text-muted-foreground">Aucun type de garde. Ouvrez Configuration des gardes pour créer les horaires de l’établissement.</p>}
        </TabsContent>

        <TabsContent value="settings" className="grid gap-4 lg:grid-cols-2">
          <Card><CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Types de gardes</h2>
            <p className="text-sm text-muted-foreground">Le nom, les heures, le service et le nombre d’infirmiers sont libres. La durée se calcule toute seule.</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => <Button key={example.name} type="button" size="sm" variant="outline" onClick={() => setForm((current) => ({ ...current, id: '', name: example.name, startTime: example.start, endTime: example.end }))}>{example.name} {example.start}–{example.end}</Button>)}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Nom</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Matin, Garde longue, Week-end…" /></div>
              <div className="space-y-2"><Label>Début</Label><Input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></div>
              <div className="space-y-2"><Label>Fin</Label><Input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></div>
              <div className="space-y-2"><Label>Service</Label><Input value={form.ward} onChange={(event) => setForm({ ...form, ward: event.target.value })} /></div>
              <div className="space-y-2"><Label>Infirmiers nécessaires</Label><Input type="number" min={1} max={30} value={form.requiredNurses} onChange={(event) => setForm({ ...form, requiredNurses: event.target.value })} /></div>
            </div>
            <p className="text-sm font-medium text-primary">Durée : {durationLabel(form.startTime, form.endTime) || '—'}</p>
            <Button type="button" onClick={saveTemplate}>{form.id ? 'Mettre à jour' : 'Enregistrer le type'}</Button>
            <div className="space-y-2">
              {templates.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
                  <span>{item.name} · {item.startTime}–{item.endTime} · {item.durationLabel} · {item.ward} · {item.requiredNurses}</span>
                  <span className="flex gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => setForm({ id: item.id, name: item.name, startTime: item.startTime, endTime: item.endTime, ward: item.ward, requiredNurses: String(item.requiredNurses) })}>Modifier</Button>
                    <Button type="button" size="icon" variant="outline" onClick={() => shiftService.deleteTemplate(item.id).then(loadConfig).catch((error) => toast({ title: 'Suppression impossible', description: apiMessage(error), variant: 'destructive' }))}><Trash2 className="h-4 w-4" /></Button>
                  </span>
                </div>
              ))}
            </div>
          </CardContent></Card>

          <Card><CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Cycles de rotation</h2>
            <p className="text-sm text-muted-foreground">Choisissez un rythme connu ou saisissez le vôtre. Il sera proposé dans le calendrier.</p>
            <div className="flex flex-wrap gap-2">
              {cycleExamples.map((example) => <Button key={example.name} type="button" size="sm" variant="outline" onClick={() => setCycleForm({ id: '', name: example.name, workDays: example.work, restDays: example.rest })}>{example.name}</Button>)}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-3"><Label>Nom du cycle</Label><Input value={cycleForm.name} onChange={(event) => setCycleForm({ ...cycleForm, name: event.target.value })} /></div>
              <div className="space-y-2"><Label>Travail</Label><Input type="number" min={1} max={31} value={cycleForm.workDays} onChange={(event) => setCycleForm({ ...cycleForm, workDays: event.target.value })} /></div>
              <div className="space-y-2"><Label>Repos</Label><Input type="number" min={1} max={31} value={cycleForm.restDays} onChange={(event) => setCycleForm({ ...cycleForm, restDays: event.target.value })} /></div>
            </div>
            <Button type="button" onClick={saveCycle}>{cycleForm.id ? 'Mettre à jour le cycle' : 'Enregistrer le cycle'}</Button>
            <div className="space-y-2">
              {cycles.map((cycle) => (
                <div key={cycle.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
                  <span>{cycle.name} · {cycle.workDays} travaillé(s) / {cycle.restDays} repos</span>
                  <span className="flex gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => setCycleForm({ id: cycle.id, name: cycle.name, workDays: String(cycle.workDays), restDays: String(cycle.restDays) })}>Modifier</Button>
                    <Button type="button" size="icon" variant="outline" onClick={() => shiftService.deleteCycle(cycle.id).then(loadConfig).catch((error) => toast({ title: 'Suppression impossible', description: apiMessage(error), variant: 'destructive' }))}><Trash2 className="h-4 w-4" /></Button>
                  </span>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(slot)} onOpenChange={(open) => { if (!open) setSlot(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{slot ? `${typeName(slot.name)} · ${dayLabel(slot.date)} · ${slot.startTime}–${slot.endTime}` : 'Affectation'}</DialogTitle>
          </DialogHeader>
          {slot && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{slot.ward} · {durationLabel(slot.startTime, slot.endTime)} · {slot.requiredNurses} infirmier(s) attendu(s), {slotNurses.length} sélectionné(s).</p>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {staff.map((nurse) => (
                  <label key={nurse.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted">
                    <input type="checkbox" checked={slotNurses.includes(nurse.id)} onChange={() => setSlotNurses((current) => current.includes(nurse.id) ? current.filter((id) => id !== nurse.id) : [...current, nurse.id])} />
                    {nurse.name}
                  </label>
                ))}
              </div>
              {slotShifts.map((shift) => (
                <div key={shift.id} className="space-y-2 rounded-xl border p-2 text-sm">
                  <p>{shift.nurseName} · {shift.status === 'draft' ? 'Brouillon' : 'Publiée'}{shift.absent ? ` · Absence : ${shift.absenceReason}` : ''}{shift.conflict ? ' · Conflit' : ''}</p>
                  {shift.status !== 'in_progress' && shift.status !== 'completed' && (
                    <div className="grid gap-2">
                      <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motif d’absence ou de remplacement" />
                      <Select value={replacement} onValueChange={setReplacement}>
                        <SelectTrigger><SelectValue placeholder="Remplaçant" /></SelectTrigger>
                        <SelectContent>{staff.filter((nurse) => nurse.id !== shift.nurseId).map((nurse) => <SelectItem key={nurse.id} value={nurse.id}>{nurse.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => shiftService.absence(shift.id, reason).then(() => { toast({ title: 'Absence enregistrée' }); setSlot(null); loadShifts(); }).catch((error) => toast({ title: 'Absence impossible', description: apiMessage(error), variant: 'destructive' }))}>Déclarer l’absence</Button>
                        <Button type="button" size="sm" variant="outline" disabled={!replacement} onClick={() => shiftService.replace(shift.id, replacement, reason).then(() => { toast({ title: 'Remplacement enregistré' }); setSlot(null); loadShifts(); }).catch((error) => toast({ title: 'Remplacement impossible', description: apiMessage(error), variant: 'destructive' }))}>Remplacer</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSlot(null)}>Fermer</Button>
            <Button type="button" onClick={saveSlot}>Enregistrer l’affectation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
