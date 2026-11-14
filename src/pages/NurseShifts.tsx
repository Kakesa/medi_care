import { useCallback, useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { shiftService, type NurseShift, type ShiftType } from '@/services/shiftService';

const typeLabel: Record<ShiftType, string> = {
  morning: 'Matin',
  afternoon: 'Après-midi',
  night: 'Nuit',
  full_day: 'Journée complète',
};
const statusLabel: Record<NurseShift['status'], string> = {
  scheduled: 'Programmée',
  confirmed: 'Confirmée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
};
const presets: Record<ShiftType, { start: string; end: string }> = {
  morning: { start: '06:00', end: '14:00' },
  afternoon: { start: '14:00', end: '22:00' },
  night: { start: '22:00', end: '06:00' },
  full_day: { start: '06:00', end: '18:00' },
};

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
function apiMessage(reason: unknown) {
  if (typeof reason === 'object' && reason && 'message' in reason && typeof reason.message === 'string') return reason.message;
  return 'Réessayez dans un instant.';
}

export default function NurseShifts() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [shifts, setShifts] = useState<NurseShift[]>([]);
  const [from, setFrom] = useState(today());
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(today());
  const [type, setType] = useState<ShiftType>('full_day');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('18:00');
  const [ward, setWard] = useState('Soins infirmiers');
  const [span, setSpan] = useState<'week' | 'month'>('week');
  const [workDays, setWorkDays] = useState('2');
  const [restDays, setRestDays] = useState('2');
  const [reason, setReason] = useState('');
  const [replacement, setReplacement] = useState('');
  const [target, setTarget] = useState('');

  const load = useCallback(() => {
    const to = addDays(from, span === 'week' ? 6 : 29);
    shiftService.list(from, to).then(setShifts).catch((error) => {
      toast({ title: 'Planning indisponible', description: apiMessage(error), variant: 'destructive' });
    });
  }, [from, span, toast]);

  useEffect(() => {
    shiftService.staff().then(setStaff).catch((error) => {
      toast({ title: 'Infirmiers indisponibles', description: apiMessage(error), variant: 'destructive' });
    });
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const changeType = (value: ShiftType) => {
    setType(value);
    setStartTime(presets[value].start);
    setEndTime(presets[value].end);
  };
  const periodEnd = addDays(date, span === 'week' ? 6 : 29);

  const save = async (mode: 'one' | 'rotation') => {
    if (!selected.length) {
      toast({ title: 'Choisissez un infirmier', variant: 'destructive' });
      return;
    }
    try {
      if (mode === 'one') {
        await shiftService.create({ nurseIds: selected, date, startTime, endTime, type, ward });
        toast({ title: 'Garde programmée', description: 'Chaque infirmier concerné a reçu une notification.' });
      } else {
        await shiftService.rotation({
          nurseIds: selected, from: date, to: periodEnd, workDays: Number(workDays), restDays: Number(restDays),
          startTime, endTime, type, ward,
        });
        toast({ title: 'Rotation créée', description: 'Les jours de travail et de repos sont répartis. Aucun remplacement n’est fait sans votre validation.' });
      }
      load();
    } catch (error) {
      toast({ title: 'Planning non enregistré', description: apiMessage(error), variant: 'destructive' });
    }
  };

  const act = async (action: 'confirm' | 'cancel' | 'absence' | 'replace', shift: NurseShift) => {
    try {
      if (action === 'confirm') await shiftService.update(shift.id, { ...shift, status: 'confirmed' });
      if (action === 'cancel') await shiftService.update(shift.id, { ...shift, status: 'cancelled' });
      if (action === 'absence') await shiftService.absence(shift.id, reason);
      if (action === 'replace') await shiftService.replace(shift.id, replacement, reason);
      setTarget('');
      setReason('');
      toast({ title: 'Planning mis à jour', description: 'Le changement est historisé et les infirmiers concernés sont prévenus.' });
      load();
    } catch (error) {
      toast({ title: 'Modification impossible', description: apiMessage(error), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-16 z-20 -mx-4 border-b bg-background/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administration</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><CalendarClock className="h-6 w-6 text-primary" />Gardes infirmières</h1>
        <p className="mt-1 text-sm text-muted-foreground">Planifiez les présences, les rotations et les remplacements. Une infirmière n’est jamais remplacée sans votre validation.</p>
      </div>

      <Card><CardContent className="grid gap-4 p-4 lg:grid-cols-[16rem_1fr]">
        <div className="space-y-2">
          <Label>Infirmiers</Label>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2">
            {staff.map((nurse) => (
              <label key={nurse.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted">
                <input type="checkbox" checked={selected.includes(nurse.id)} onChange={() => toggle(nurse.id)} />
                {nurse.name}
              </label>
            ))}
            {!staff.length && <p className="p-2 text-sm text-muted-foreground">Aucun infirmier actif.</p>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
          <div className="space-y-2"><Label>Type</Label>
            <Select value={type} onValueChange={(value) => changeType(value as ShiftType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(typeLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Début</Label><Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></div>
          <div className="space-y-2"><Label>Fin</Label><Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Service</Label><Input value={ward} onChange={(event) => setWard(event.target.value)} /></div>
          <div className="space-y-2"><Label>Période</Label>
            <Select value={span} onValueChange={(value) => setSpan(value as 'week' | 'month')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semaine</SelectItem>
                <SelectItem value="month">Mois (30 jours)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label>Jours travaillés</Label><Input type="number" min={1} max={14} value={workDays} onChange={(event) => setWorkDays(event.target.value)} /></div>
            <div className="space-y-2"><Label>Jours de repos</Label><Input type="number" min={1} max={14} value={restDays} onChange={(event) => setRestDays(event.target.value)} /></div>
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-4">
            <Button type="button" onClick={() => save('one')}>Programmer la garde</Button>
            <Button type="button" variant="outline" onClick={() => save('rotation')}>Créer la rotation</Button>
          </div>
        </div>
      </CardContent></Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setFrom(addDays(from, span === 'week' ? -7 : -30))}>Période précédente</Button>
        <p className="text-sm text-muted-foreground">{dayLabel(from)} – {dayLabel(addDays(from, span === 'week' ? 6 : 29))}</p>
        <Button type="button" variant="outline" onClick={() => setFrom(addDays(from, span === 'week' ? 7 : 30))}>Période suivante</Button>
      </div>

      <div className="space-y-3">
        {shifts.map((shift) => (
          <Card key={shift.id}><CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{shift.nurseName}</p>
                <p className="text-sm text-muted-foreground">{dayLabel(shift.date)} · {typeLabel[shift.type]} · {shift.startTime}–{shift.endTime} · {shift.ward}</p>
                <p className="text-sm">{statusLabel[shift.status]}{shift.absent ? ` · Absence : ${shift.absenceReason}` : ''}</p>
              </div>
              {shift.status !== 'completed' && shift.status !== 'cancelled' && shift.status !== 'in_progress' && (
                <div className="flex flex-wrap gap-2">
                  {shift.status === 'scheduled' && <Button type="button" size="sm" variant="outline" onClick={() => act('confirm', shift)}>Confirmer</Button>}
                  <Button type="button" size="sm" variant="outline" onClick={() => setTarget(target === shift.id ? '' : shift.id)}>Absence ou remplacement</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => act('cancel', shift)}>Annuler</Button>
                </div>
              )}
            </div>
            {target === shift.id && (
              <div className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_16rem_auto_auto]">
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motif de l’absence ou du remplacement" />
                <Select value={replacement} onValueChange={setReplacement}>
                  <SelectTrigger><SelectValue placeholder="Infirmier remplaçant" /></SelectTrigger>
                  <SelectContent>{staff.filter((nurse) => nurse.id !== shift.nurseId).map((nurse) => <SelectItem key={nurse.id} value={nurse.id}>{nurse.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => act('absence', shift)}>Déclarer l’absence</Button>
                <Button type="button" onClick={() => act('replace', shift)} disabled={!replacement}>Remplacer</Button>
              </div>
            )}
          </CardContent></Card>
        ))}
        {!shifts.length && <p className="text-sm text-muted-foreground">Aucune garde sur cette période.</p>}
      </div>
    </div>
  );
}
