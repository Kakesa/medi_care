import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarClock, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { enablePush as enablePushNotifications } from '@/pwa/push';
import { shiftService, type NurseShift, type ShiftBoard } from '@/services/shiftService';

const statusLabel: Record<NurseShift['status'], string> = {
  draft: 'Brouillon',
  scheduled: 'Publiée',
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

function shortDay(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`)).split('.').join('');
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


function ShiftLine({ shift }: { shift: NurseShift }) {
  return (
    <p className="text-xs leading-snug">
      <span className="font-semibold capitalize">{shortDay(shift.date)}</span>
      <span className="text-foreground/70"> · {shift.startTime}–{shift.endTime}</span>
      {shift.absent ? <span className="block text-[10px]">Absence</span> : null}
    </p>
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
    const result = await enablePushNotifications();
    if (result === 'enabled') {
      toast({ title: 'Rappels activés', description: 'Vous serez prévenu(e) la veille, avant la prise de service et au début de la garde. Aucun dossier médical n’apparaît sur l’écran verrouillé.' });
      return;
    }
    const description = result === 'denied'
      ? 'Les notifications du téléphone sont désactivées. Les rappels restent visibles dans MediCare.'
      : result === 'unconfigured'
        ? 'Les notifications push ne sont pas encore activées sur le serveur. Les rappels internes continuent.'
        : 'Cet appareil ne reçoit pas les notifications push. Les rappels restent dans le centre de notifications.';
    toast({ title: 'Rappels dans l’application', description });
  };

  if (!board) return null;
  const active = board.today.find((shift) => shift.status === 'in_progress' || shift.status === 'scheduled' || shift.status === 'confirmed');

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Mes gardes</p>
          <h2 className="text-lg font-semibold leading-tight">Planning de travail</h2>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={enablePush}><Bell className="h-4 w-4 sm:mr-2" /><span className="ml-1 sm:ml-0">Rappels</span></Button>
      </div>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Card className="border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/40"><CardContent className="space-y-1 p-2.5 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-teal-900 dark:text-teal-100"><CalendarClock className="h-3.5 w-3.5 shrink-0" />Prochaine</p>
          {board.next ? <ShiftLine shift={board.next} /> : <p className="text-xs text-teal-900/70 dark:text-teal-100/70">Aucune</p>}
        </CardContent></Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"><CardContent className="space-y-1 p-2.5 sm:p-4">
          <p className="text-xs font-medium text-amber-950 dark:text-amber-100">Aujourd’hui</p>
          {board.today.length ? board.today.map((shift) => <ShiftLine key={shift.id} shift={shift} />) : <p className="text-xs text-amber-950/70 dark:text-amber-100/70">Aucune</p>}
        </CardContent></Card>
        <Card className="border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40"><CardContent className="space-y-1 p-2.5 sm:p-4">
          <p className="text-xs font-medium text-sky-950 dark:text-sky-100">À venir</p>
          {board.upcoming.slice(0, 3).map((shift) => <ShiftLine key={shift.id} shift={shift} />)}
          {!board.upcoming.length && <p className="text-xs text-sky-950/70 dark:text-sky-100/70">Aucune sur 30 j</p>}
        </CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"><CardContent className="space-y-1.5 p-2.5 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-950 dark:text-emerald-100"><Moon className="h-3.5 w-3.5 shrink-0" />Repos · {board.restDays.length}</p>
          {board.restDays.length ? (
            <div className="flex flex-wrap gap-1">
              {board.restDays.slice(0, 8).map((date) => (
                <span key={date} className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-medium capitalize text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-50">{shortDay(date)}</span>
              ))}
            </div>
          ) : <p className="text-xs text-emerald-950/70 dark:text-emerald-100/70">Aucun</p>}
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
            <p key={shift.id} className="text-xs text-muted-foreground sm:text-sm">
              {shortDay(shift.date)} · {shift.startTime}–{shift.endTime} · {statusLabel[shift.status]}
              {shift.actualStartedAt ? ` · réel ${clock(shift.actualStartedAt)}` : ''}
              {shift.actualEndedAt ? `–${clock(shift.actualEndedAt)}` : ''}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
