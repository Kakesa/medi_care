import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { nursingService, type ActiveTreatmentRow } from '@/services/nursingService';
import { LineExcerpt, TextExcerpt } from '@/pages/nursing/TextExcerpt';

function whenLabel(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00.000Z`));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kinshasa' }).format(date);
}

export function ActiveTreatments({ onOpen }: { onOpen: (patientId: string) => void }) {
  const [rows, setRows] = useState<ActiveTreatmentRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    nursingService.getActiveTreatments()
      .then((result) => { if (active) setRows(result.rows); })
      .catch(() => { if (active) setError('Les traitements en cours sont indisponibles.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => `${row.patientName} ${row.products.join(' ')} ${row.conclusion} ${row.analysis} ${row.nurseName}`.toLowerCase().includes(term));
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Chargement...' : `${visible.length} patient${visible.length > 1 ? 's' : ''}`}
        </p>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Patient, conclusion ou analyse" className="pl-9" aria-label="Rechercher dans les traitements en cours" />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Aucun traitement en cours.</CardContent></Card>
      )}
      {visible.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[9rem]">Date et heure</TableHead>
                <TableHead className="min-w-[10rem]">Patient</TableHead>
                <TableHead className="min-w-[12rem]">Produits</TableHead>
                <TableHead className="min-w-[14rem]">Conclusion</TableHead>
                <TableHead className="min-w-[14rem]">Analyse</TableHead>
                <TableHead className="min-w-[10rem]">Infirmier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.patientId}>
                  <TableCell className="whitespace-nowrap align-top">{whenLabel(row.at)}</TableCell>
                  <TableCell className="align-top">
                    <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => onOpen(row.patientId)}>
                      {row.patientName}
                    </button>
                  </TableCell>
                  <TableCell className="max-w-[14rem] align-top"><LineExcerpt lines={row.products} /></TableCell>
                  <TableCell className="max-w-[16rem] align-top"><TextExcerpt text={row.conclusion} /></TableCell>
                  <TableCell className="max-w-[16rem] align-top"><TextExcerpt text={row.analysis} /></TableCell>
                  <TableCell className="align-top">{row.nurseName || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
