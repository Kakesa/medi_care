import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarClock, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { shiftService, type NurseShift, type ShiftBoard } from '@/services/shiftService';

const statusLabel: Record<NurseShift['status'], string> = {
  scheduled: 'Programmée',
  confirmed: 'Confirmée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

function dayLabel(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function clock(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kinshasa',
  }).format(new Date(value));
}

function apiMessage(reason: unknown) {
  if (typeof reason === 'object' && reason && 'message' in reason && typeof reason.message === 'string') return reason.message;
  return 'Réessayez dans un instant.';
}

function keyToBytes(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function ShiftLine({ shift }: { shift: NurseShift }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2 text-sm">
      <p className="font-medium capitalize">{dayLabel(shift.date)}</p>
      <p className="text-muted-foreground">{shift.startTime} – {shift.endTime} · {shift.ward} · {statusLabel[shift.status]}{shift.absent ? ' · Absence déclarée' : ''}</p>
    </div>
  );
}

export function NurseShiftBoard() {
  const { toast } = useToast();
  const [board, setBoard] = useState<ShiftBoard | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    shiftService.mine().then(setBoard).catch((error) => {
      toast({ title: 'Planning indisponible', description: apiMessage(error), variant: 'destructive' });
    });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const run = async (id: string, action: 'start' | 'end') => {
    setBusy(id);
    try {
      if (action === 'start') await shiftService.start(id);
      else await shiftService.end(id, note);
      setNote('');
      toast({ title: action === 'start' ? 'Garde commencée' : 'Garde terminée', description: action === 'end' ? 'La transmission est enregistrée. La feuille de traitement reste accessible.' : 'L’heure réelle de prise de service est enregistrée.' });
      load();
    } catch (error) {
      toast({ title: 'Opération impossible', description: apiMessage(error), variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const enablePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast({ title: 'Rappels dans l’application', description: 'Cet appareil ne reçoit pas les notifications push. Les rappels restent dans le centre de notifications.' });
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast({ title: 'Rappels dans l’application', description: 'Les notifications du téléphone sont désactivées. Les rappels restent visibles dans MediCare.' });
      return;
    }
    const { publicKey } = await shiftService.pushKey();
    if (!publicKey) {
      toast({ title: 'Rappels dans l’application', description: 'Les notifications push ne sont pas encore activées sur le serveur. Les rappels internes continuent.' });
      return;
    }
    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(publicKey),
    });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
    await shiftService.subscribe({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
    toast({ title: 'Rappels activés', description: 'Vous serez prévenu(e) la veille, avant la prise de service et au début de la garde.' });
  };

  if (!board) return null;
  const active = board.today.find((shift) => shift.status === 'in_progress' || shift.status === 'scheduled' || shift.status === 'confirmed');

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Mes gardes</p>
          <h2 className="text-xl font-semibold">Planning de travail</h2>
        </div>
        <Button type="button" variant="outline" onClick={enablePush}><Bell className="mr-2 h-4 w-4" />Activer les rappels</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-teal-200 bg-teal-50"><CardContent className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-teal-900"><CalendarClock className="h-4 w-4" />Ma prochaine garde</p>
          {board.next ? <ShiftLine shift={board.next} /> : <p className="text-sm text-teal-900/70">Aucune garde à venir.</p>}
        </CardContent></Card>
        <Card className="border-amber-200 bg-amber-50"><CardContent className="space-y-2 p-4">
          <p className="text-sm font-medium text-amber-950">Mes gardes d’aujourd’hui</p>
          {board.today.length ? board.today.map((shift) => <ShiftLine key={shift.id} shift={shift} />) : <p className="text-sm text-amber-950/70">Pas de garde aujourd’hui.</p>}
        </CardContent></Card>
        <Card className="border-sky-200 bg-sky-50"><CardContent className="space-y-2 p-4">
          <p className="text-sm font-medium text-sky-950">Mes prochaines gardes</p>
          {board.upcoming.slice(0, 4).map((shift) => <ShiftLine key={shift.id} shift={shift} />)}
          {!board.upcoming.length && <p className="text-sm text-sky-950/70">Rien de planifié sur 30 jours.</p>}
        </CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50"><CardContent className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-950"><Moon className="h-4 w-4" />Mes jours de repos</p>
          <p className="text-sm text-emerald-950/80">{board.restDays.length ? board.restDays.slice(0, 8).map((date) => dayLabel(date)).join(' · ') : 'Aucun repos sur les 14 prochains jours.'}</p>
        </CardContent></Card>
      </div>
      {active && active.status !== 'completed' && (
        <Card><CardContent className="space-y-3 p-4">
          <p className="text-sm">Garde du {dayLabel(active.date)}, {active.startTime} – {active.endTime}, {active.ward}.</p>
          {active.status === 'in_progress' ? (
            <>
              <p className="text-sm text-muted-foreground">Prise de service à {clock(active.actualStartedAt)}. Décrivez la transmission pour l’équipe suivante.</p>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ce qui a été fait et ce qui reste à faire" />
              <Button type="button" disabled={busy === active.id} onClick={() => run(active.id, 'end')}>Terminer ma garde</Button>
            </>
          ) : (
            <Button type="button" disabled={busy === active.id} onClick={() => run(active.id, 'start')}>Commencer ma garde</Button>
          )}
        </CardContent></Card>
      )}
      {board.handover && (
        <Card><CardContent className="space-y-1 p-4 text-sm">
          <p className="font-medium">Transmission de l’équipe précédente · {dayLabel(board.handover.date)} · {board.handover.ward}</p>
          {board.handover.note && <p>{board.handover.note}</p>}
          {board.handover.summary && <p className="whitespace-pre-line text-muted-foreground">{board.handover.summary}</p>}
        </CardContent></Card>
      )}
      {board.history.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Mon historique des gardes</p>
          {board.history.slice(0, 6).map((shift) => (
            <p key={shift.id} className="text-sm text-muted-foreground">
              {dayLabel(shift.date)} · {shift.startTime}–{shift.endTime} · {statusLabel[shift.status]}
              {shift.actualStartedAt ? ` · réel ${clock(shift.actualStartedAt)}` : ''}
              {shift.actualEndedAt ? `–${clock(shift.actualEndedAt)}` : ''}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
