import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { nursingService, type TreatmentJournal } from '@/services/nursingService';
import { LineExcerpt, TextExcerpt } from '@/pages/nursing/TextExcerpt';

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

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
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
      patients: day.patients.filter((patient) => `${patient.firstName} ${patient.lastName} ${patient.room} ${patient.conclusion} ${patient.analysis}`.toLowerCase().includes(query)),
    })).filter((day) => day.patients.length > 0);
  }, [journal, search]);
  const rows = days.flatMap((day) => day.patients.map((patient) => {
    const times = [...new Set(patient.doses.map((dose) => clock(dose.administeredAt)))];
    const nurses = [...new Set(patient.doses.map((dose) => dose.nurseName).filter(Boolean))];
    return {
      key: `${day.date}-${patient.patientId}`,
      when: times.length === 1 ? `${dateLabel(day.date)} · ${times[0]}` : dateLabel(day.date),
      patient: `${patient.firstName} ${patient.lastName}${patient.room ? ` · Ch. ${patient.room}` : ''}`,
      products: patient.doses.map((dose) => ({
        label: `${times.length === 1 ? '' : `${clock(dose.administeredAt)} · `}${dose.medication}${dose.route ? ` · ${dose.route}` : ''}`,
        late: dose.status === 'administered_late',
      })),
      nurse: nurses.join(', ') || '—',
      conclusion: patient.conclusion,
      analysis: patient.analysis,
    };
  }));
  const shownPatients = new Set(days.flatMap((day) => day.patients.map((patient) => patient.patientId))).size;

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
      {!error && rows.length === 0 && <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">Aucun traitement administré sur cette période.</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[64rem]">
            <div className="grid grid-cols-[9rem_1.1fr_1.1fr_1.3fr_1.3fr_1fr] bg-muted/60 text-xs font-semibold text-muted-foreground">
              <div className="border-r px-3 py-2">Date et heure</div>
              <div className="border-r px-3 py-2">Nom</div>
              <div className="border-r px-3 py-2">Produits</div>
              <div className="border-r px-3 py-2">Conclusion</div>
              <div className="border-r px-3 py-2">Analyse</div>
              <div className="px-3 py-2">Infirmier</div>
            </div>
            {rows.map((row) => (
              <div key={row.key} className="grid grid-cols-[9rem_1.1fr_1.1fr_1.3fr_1.3fr_1fr] border-t text-sm">
                <div className="border-r px-3 py-2 whitespace-nowrap">{row.when}</div>
                <div className="border-r px-3 py-2 font-medium">{row.patient}</div>
                <div className="border-r px-3 py-2">
                  <LineExcerpt lines={row.products.map((product) => `${product.label}${product.late ? ' · en retard' : ''}`)} />
                </div>
                <div className="border-r px-3 py-2"><TextExcerpt text={row.conclusion} /></div>
                <div className="border-r px-3 py-2"><TextExcerpt text={row.analysis} /></div>
                <div className="px-3 py-2">{row.nurse}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
