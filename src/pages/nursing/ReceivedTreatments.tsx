import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { nursingService, type TreatmentJournal } from '@/services/nursingService';

type Period = 'day' | 'week' | 'month' | 'custom';

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function bounds(period: Period, anchor: string, customFrom: string, customTo: string) {
  if (period === 'day') return { from: anchor, to: anchor };
  if (period === 'week') {
    const day = new Date(`${anchor}T12:00:00Z`).getUTCDay();
    const from = addDays(anchor, day === 0 ? -6 : 1 - day);
    return { from, to: addDays(from, 6) };
  }
  if (period === 'month') {
    const [year, month] = anchor.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: `${anchor.slice(0, 8)}01`, to: `${anchor.slice(0, 8)}${String(last).padStart(2, '0')}` };
  }
  return { from: customFrom, to: customTo >= customFrom ? customTo : customFrom };
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

function clock(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kinshasa' }).format(new Date(value));
}

const periods: Array<{ id: Period; label: string }> = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'custom', label: 'Période' },
];

export function ReceivedTreatments() {
  const [period, setPeriod] = useState<Period>('day');
  const [anchor, setAnchor] = useState(today());
  const [customFrom, setCustomFrom] = useState(today());
  const [customTo, setCustomTo] = useState(today());
  const [search, setSearch] = useState('');
  const [journal, setJournal] = useState<TreatmentJournal | null>(null);
  const [error, setError] = useState('');
  const range = bounds(period, anchor, customFrom, customTo);

  useEffect(() => {
    let active = true;
    setError('');
    nursingService.getJournal(range.from, range.to)
      .then((value) => { if (active) setJournal(value); })
      .catch(() => { if (active) setError('Le journal des traitements est indisponible.'); });
    return () => { active = false; };
  }, [range.from, range.to]);

  const days = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!journal || !query) return journal?.days ?? [];
    return journal.days.map((day) => ({
      ...day,
      patients: day.patients.filter((patient) => `${patient.firstName} ${patient.lastName} ${patient.room}`.toLowerCase().includes(query)),
    })).filter((day) => day.patients.length > 0);
  }, [journal, search]);
  const shownPatients = days.reduce((sum, day) => sum + day.patients.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {periods.map((item) => (
          <button key={item.id} type="button" onClick={() => setPeriod(item.id)} className={`rounded-full px-3 py-1 text-xs font-medium ${period === item.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {item.label}
          </button>
        ))}
        {period !== 'custom' && <Input className="h-8 w-36" type="date" value={anchor} onChange={(event) => setAnchor(event.target.value)} aria-label="Date de référence" />}
        {period === 'custom' && (
          <>
            <Input className="h-8 w-36" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} aria-label="Début" />
            <Input className="h-8 w-36" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} aria-label="Fin" />
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{shownPatients} patient(s) ont reçu un traitement.</p>
        <Input className="h-8 w-full sm:w-56" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un patient" aria-label="Rechercher un patient" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && days.length === 0 && <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">Aucun traitement administré sur cette période.</p>}
      {days.map((day) => (
        <section key={day.date} className="space-y-2">
          <h2 className="text-sm font-semibold capitalize">{dayLabel(day.date)}</h2>
          {day.patients.map((patient) => (
            <Card key={`${day.date}-${patient.patientId}`}>
              <CardContent className="space-y-1 p-3">
                <p className="font-medium">{patient.firstName} {patient.lastName}{patient.room ? ` · Ch. ${patient.room}` : ''}</p>
                {patient.doses.map((dose, index) => (
                  <p key={`${dose.medication}-${dose.administeredAt}-${index}`} className="text-xs text-muted-foreground">
                    {clock(dose.administeredAt)} · {dose.medication} · {dose.route} · {dose.status === 'administered_late' ? 'en retard' : 'à l’heure'}{dose.nurseName ? ` · ${dose.nurseName}` : ''}
                  </p>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}
