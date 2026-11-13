import { FormEvent, useMemo, useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PatientSelect } from '@/components/patients/PatientSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { apiMessage } from '@/lib/apiError';
import { useToast } from '@/hooks/use-toast';
import { nursingService } from '@/services/nursingService';
import type { NursingPatient, NursingPatientDetail, NursingVitalSigns } from '@/types/nursing';

const fields = [
  ['systolic', 'Tension systolique', 'mmHg', '40', '300'],
  ['diastolic', 'Tension diastolique', 'mmHg', '20', '200'],
  ['temperature', 'Température', '°C', '25', '45'],
  ['heartRate', 'Fréquence cardiaque', 'bpm', '20', '300'],
  ['respiratoryRate', 'Fréquence respiratoire', '/min', '1', '100'],
  ['oxygenSaturation', 'Saturation (SpO₂)', '%', '0', '100'],
  ['glucose', 'Glycémie', 'mg/dL', '0', '1000'],
] as const;

function localDateTime(date = new Date()) {
  const value = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return value.toISOString().slice(0, 16);
}

function displayDate(value?: string) {
  return value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function VitalTrend({ data, dataKey, label, color }: {
  data: Array<Record<string, string | number | undefined>>;
  dataKey: string;
  label: string;
  color: string;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey={dataKey} name={label} stroke={color} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function measurementLines(row: NursingVitalSigns) {
  const lines: Array<{ label: string; value: string; unit: string }> = [];
  if (row.systolic != null || row.diastolic != null) lines.push({ label: 'Tension artérielle', value: `${row.systolic ?? '—'}/${row.diastolic ?? '—'}`, unit: 'mmHg' });
  if (row.temperature != null) lines.push({ label: 'Température', value: String(row.temperature), unit: '°C' });
  if (row.heartRate != null) lines.push({ label: 'Fréquence cardiaque', value: String(row.heartRate), unit: 'bpm' });
  if (row.respiratoryRate != null) lines.push({ label: 'Fréquence respiratoire', value: String(row.respiratoryRate), unit: '/min' });
  if (row.oxygenSaturation != null) lines.push({ label: 'SpO₂', value: String(row.oxygenSaturation), unit: '%' });
  if (row.glucose != null) lines.push({ label: 'Glycémie', value: String(row.glucose), unit: 'mg/dL' });
  if (row.height != null) lines.push({ label: 'Taille', value: String(row.height), unit: 'cm' });
  return lines;
}

export function SurveillanceSheet({
  patients,
  selectedId,
  onSelectPatient,
  detail,
  canWrite,
  onSaved,
}: {
  patients: NursingPatient[];
  selectedId: string;
  onSelectPatient: (id: string) => void;
  detail: NursingPatientDetail | null;
  canWrite: boolean;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [measuredAt, setMeasuredAt] = useState(localDateTime());
  const [observation, setObservation] = useState('');
  const patient = patients.find((item) => item.id === selectedId);

  const chartData = useMemo(() => [...(detail?.vitals ?? [])].reverse().map((row) => ({
    time: new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(row.measuredAt)),
    temperature: row.temperature,
    heartRate: row.heartRate,
    respiratoryRate: row.respiratoryRate,
    oxygenSaturation: row.oxygenSaturation,
    systolic: row.systolic,
    glucose: row.glucose,
  })), [detail?.vitals]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    const measurements = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim() !== '').map(([key, value]) => [key, Number(value)])
    );
    if (!Object.keys(measurements).length) {
      toast({ title: 'Indiquez au moins une constante', variant: 'destructive' });
      return;
    }
    try {
      const created = await nursingService.createVitals({
        patientId: selectedId,
        measuredAt: new Date(measuredAt).toISOString(),
        ...measurements,
        ...(observation.trim() ? { observation: observation.trim() } : {}),
      });
      toast({
        title: 'Surveillance enregistrée',
        description: created.alerts.length ? `Alerte de seuil : ${created.alerts.join(', ')}` : 'La mesure est ajoutée à la feuille.',
      });
      setValues({});
      setObservation('');
      setMeasuredAt(localDateTime());
      await onSaved();
    } catch (error) {
      toast({ title: 'Enregistrement impossible', description: apiMessage(error), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {canWrite && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5" />Nouvelle surveillance</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Patient</Label>
                <PatientSelect patients={patients} value={selectedId} onValueChange={onSelectPatient} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="surveillance-time">Date et heure</Label>
                <Input id="surveillance-time" type="datetime-local" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} required />
              </div>
              {fields.map(([key, label, unit, min, max]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`vital-${key}`}>{label} ({unit})</Label>
                  <Input id={`vital-${key}`} type="number" step="any" min={min} max={max} value={values[key] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} />
                </div>
              ))}
              <div className="space-y-2 sm:col-span-2 lg:col-span-4">
                <Label htmlFor="vital-observation">Observation infirmière</Label>
                <Textarea id="vital-observation" value={observation} maxLength={1000} onChange={(event) => setObservation(event.target.value)} placeholder="État du patient, douleur, comportement..." />
              </div>
              <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" disabled={!selectedId}>Enregistrer la surveillance</Button></div>
            </form>
          </CardContent>
        </Card>
      )}
      {patient && (
        <Card>
          <CardHeader>
            <CardTitle>Évolution · {patient.firstName} {patient.lastName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <VitalTrend data={chartData} dataKey="temperature" label="Température (°C)" color="hsl(var(--primary))" />
              <VitalTrend data={chartData} dataKey="heartRate" label="Fréquence cardiaque (bpm)" color="#ef4444" />
              <VitalTrend data={chartData} dataKey="oxygenSaturation" label="SpO₂ (%)" color="#0ea5e9" />
              <VitalTrend data={chartData} dataKey="systolic" label="Tension systolique (mmHg)" color="#f59e0b" />
              <VitalTrend data={chartData} dataKey="respiratoryRate" label="Fréquence respiratoire (/min)" color="#8b5cf6" />
              <VitalTrend data={chartData} dataKey="glucose" label="Glycémie (mg/dL)" color="#16a34a" />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date et heure</TableHead>
                    <TableHead>Constante</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead>Observation</TableHead>
                    <TableHead>Infirmier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detail?.vitals ?? []).flatMap((row) => {
                    const lines = measurementLines(row);
                    const shown = lines.length ? lines : [{ label: 'Observation', value: '—', unit: '—' }];
                    return shown.map((line, index) => (
                      <TableRow key={`${row.id}-${line.label}`}>
                        <TableCell>{index === 0 ? displayDate(row.measuredAt) : ''}</TableCell>
                        <TableCell>{line.label}</TableCell>
                        <TableCell>{line.value}</TableCell>
                        <TableCell>{line.unit}</TableCell>
                        <TableCell className="max-w-xs whitespace-normal">{index === 0 ? row.observation || (row.alerts.length ? row.alerts.join(' · ') : '—') : ''}</TableCell>
                        <TableCell>{index === 0 ? row.recordedByName || '—' : ''}</TableCell>
                      </TableRow>
                    ));
                  })}
                  {(detail?.observations ?? []).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{displayDate(entry.observedAt)}</TableCell>
                      <TableCell>Observation</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="max-w-xs whitespace-normal">{entry.content}</TableCell>
                      <TableCell>{entry.nurseName || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!detail?.vitals.length && !detail?.observations.length && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucune surveillance enregistrée pour ce dossier.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
