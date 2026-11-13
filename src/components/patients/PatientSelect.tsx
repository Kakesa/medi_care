import { useMemo, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type PatientOption = {
  id: string;
  firstName: string;
  lastName: string;
  room?: string;
  phone?: string;
};

export function PatientSelect({
  patients,
  value,
  onValueChange,
  placeholder = 'Rechercher un patient',
  clearLabel,
  disabled,
  className,
}: {
  patients: PatientOption[];
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = patients.find((patient) => patient.id === value);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr');
    const rows = term
      ? patients.filter((patient) => `${patient.firstName} ${patient.lastName} ${patient.room ?? ''} ${patient.phone ?? ''}`.toLocaleLowerCase('fr').includes(term))
      : patients;
    return rows.slice(0, 40);
  }, [patients, query]);

  const choose = (id: string) => {
    onValueChange(id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        aria-expanded={open}
        className={cn('h-11 w-full justify-between px-3 font-normal', !selected && 'text-muted-foreground')}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selected ? `${selected.firstName} ${selected.lastName}` : (!value && clearLabel ? clearLabel : placeholder)}</span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </Button>
      {open && !disabled && (
        <div className="rounded-xl border bg-popover p-2 shadow-sm">
          <Input
            autoFocus
            value={query}
            placeholder="Nom, chambre ou téléphone"
            aria-label="Rechercher un patient"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {clearLabel && (
              <button type="button" className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent" onClick={() => choose('')}>
                {clearLabel}
              </button>
            )}
            {filtered.map((patient) => (
              <button
                key={patient.id}
                type="button"
                className={cn('w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent', patient.id === value && 'bg-accent')}
                onClick={() => choose(patient.id)}
              >
                <span className="font-medium">{patient.firstName} {patient.lastName}</span>
                {(patient.room || patient.phone) && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {[patient.room ? `Chambre ${patient.room}` : '', patient.phone ?? ''].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Aucun patient trouvé.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
