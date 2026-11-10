import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BedDouble, CalendarDays, CheckCircle2, ClipboardList, Clock3,
  FileText, HeartPulse, Pencil, Plus, Stethoscope, UserRound, XCircle,
} from 'lucide-react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { apiMessage } from '@/lib/apiError';
import { useToast } from '@/hooks/use-toast';
import { nursingService } from '@/services/nursingService';
import type {
  MedicationAdministration, MedicationAdministrationSheet,
  NursingCare, NursingCareStatus, NursingCareType, NursingDashboard, NursingPatient,
  NursingPatientDetail, NursingReport, NursingThresholds,
} from '@/types/nursing';

const careLabels: Record<NursingCareType, string> = {
  medication: 'Administration de médicament',
  injection: 'Injection',
  infusion: 'Perfusion',
  dressing: 'Pansement',
  sample: 'Prélèvement',
  monitoring: 'Surveillance',
  hygiene: 'Soins d’hygiène',
  assistance: 'Assistance au patient',
  other: 'Autre soin',
};

const statusLabels: Record<NursingCareStatus, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Réalisé',
  not_done: 'Non réalisé',
  cancelled: 'Annulé',
};

const statusVariants: Record<NursingCareStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'outline',
  not_done: 'destructive',
  cancelled: 'outline',
};

const administrationStatusLabels = {
  pending: 'En attente',
  administered_on_time: 'Administré à l’heure',
  administered_late: 'Administré en retard',
  not_administered: 'Non administré',
  patient_refused: 'Refus du patient',
  suspended: 'Suspendu par le médecin',
  treatment_completed: 'Traitement terminé',
  treatment_interrupted: 'Traitement interrompu',
} as const;

const administrationStatusStyles = {
  pending: 'border-muted text-muted-foreground',
  administered_on_time: 'border-green-600 bg-green-50 text-green-800',
  administered_late: 'border-amber-500 bg-amber-50 text-amber-800',
  not_administered: 'border-red-600 bg-red-50 text-red-800',
  patient_refused: 'border-red-600 bg-red-50 text-red-800',
  suspended: 'border-muted bg-muted text-muted-foreground',
  treatment_completed: 'border-muted bg-muted text-muted-foreground',
  treatment_interrupted: 'border-muted bg-muted text-muted-foreground',
} as const;

const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const facilityDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const localDateTime = (date = new Date()) => {
  const value = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return value.toISOString().slice(0, 16);
};

const displayDate = (value?: string) => value
  ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

const displayMedicationDate = (value: string, timeZone: string) => new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short', timeStyle: 'short', timeZone,
}).format(new Date(value));

const displayFacilityDate = (value?: string) => value
  ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeZone: 'Africa/Kinshasa' }).format(new Date(value))
  : '—';

const treatmentProgress = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) return 'Dates de traitement non structurées';
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  const today = Date.parse(`${facilityDate()}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 'Dates de traitement invalides';
  const totalDays = Math.floor((end - start) / 86_400_000) + 1;
  if (today < start) return `${totalDays} jour(s) prescrits · début le ${displayFacilityDate(startDate)}`;
  const elapsedDays = Math.min(totalDays, Math.floor((today - start) / 86_400_000) + 1);
  return `${elapsedDays} jour(s) écoulé(s) · ${Math.max(0, totalDays - elapsedDays)} restant(s)`;
};

function MetricCard({ title, value, icon: Icon, tone = 'text-primary' }: {
  title: string; value: number; icon: typeof Activity; tone?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className={`h-8 w-8 ${tone}`} />
      </CardContent>
    </Card>
  );
}

function PatientTable({ patients, selectedId, onSelect }: {
  patients: NursingPatient[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>Dossier</TableHead>
            <TableHead>Service / chambre</TableHead>
            <TableHead>Médecin</TableHead>
            <TableHead>Dernières constantes</TableHead>
            <TableHead>Prochain soin</TableHead>
            <TableHead>État</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => {
            const vitals = patient.lastVitals;
            const alertCount = vitals && 'alerts' in vitals ? vitals.alerts.length : 0;
            return (
              <TableRow
                key={patient.id}
                className={selectedId === patient.id ? 'bg-muted/60' : 'cursor-pointer'}
                onClick={() => onSelect(patient.id)}
              >
                <TableCell className="font-medium">{patient.firstName} {patient.lastName}{patient.age !== undefined ? ` · ${patient.age} ans` : ''}</TableCell>
                <TableCell className="font-mono text-xs">{patient.recordNumber.slice(-8).toUpperCase()}</TableCell>
                <TableCell>{patient.ward ?? '—'}{patient.room ? ` · ${patient.room}` : ''}</TableCell>
                <TableCell>{patient.doctor ?? '—'}</TableCell>
                <TableCell>
                  {vitals && 'temperature' in vitals ? `${vitals.temperature ?? '—'}° · ${'heartRate' in vitals ? vitals.heartRate ?? '—' : '—'} bpm · ${vitals.oxygenSaturation ?? '—'}%` : '—'}
                  {alertCount > 0 && <Badge variant="destructive" className="ml-2">{alertCount} alerte(s)</Badge>}
                </TableCell>
                <TableCell>{patient.nextCare ? `${displayDate(patient.nextCare.scheduledAt)} · ${patient.nextCare.description}` : 'Non programmé'}</TableCell>
                <TableCell><Badge variant={patient.status === 'hospitalized' ? 'default' : 'secondary'}>{patient.status === 'hospitalized' ? 'Hospitalisé' : 'Observation'}</Badge></TableCell>
              </TableRow>
            );
          })}
          {patients.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Aucun patient autorisé à afficher.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

function CareTable({ care, canUpdate, onUpdate, onCorrect }: {
  care: NursingCare[];
  canUpdate: boolean;
  onUpdate: (row: NursingCare, status: 'completed' | 'not_done') => void;
  onCorrect?: (row: NursingCare) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow><TableHead>Horaire</TableHead><TableHead>Patient</TableHead><TableHead>Soin</TableHead><TableHead>Statut</TableHead><TableHead>Observations / motif</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
        <TableBody>
          {care.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{displayDate(row.scheduledAt)}</TableCell>
              <TableCell className="font-mono text-xs">{row.patientId.slice(-8).toUpperCase()}</TableCell>
              <TableCell>
                <p className="font-medium">{careLabels[row.type]}</p>
                <p className="max-w-sm text-xs text-muted-foreground">{row.description}{row.medication ? ` · ${row.medication} ${row.prescribedDose ?? ''}` : ''}</p>
                {row.administrationRoute && <p className="text-xs text-muted-foreground">Voie : {row.administrationRoute}</p>}
              </TableCell>
              <TableCell><Badge variant={statusVariants[row.status]}>{statusLabels[row.status]}</Badge></TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                <p>{row.notDoneReason ?? row.observations ?? '—'}</p>
                {row.history.map((entry, index) => <p key={`${entry.at}-${index}`} className="mt-1 text-xs text-muted-foreground">
                  {entry.action.split('_').join(' ')} · {displayDate(entry.at)}{entry.reason ? ` · ${entry.reason}` : ''}
                </p>)}
              </TableCell>
              <TableCell>
                {canUpdate && (row.status === 'pending' || row.status === 'in_progress') && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" aria-label="Clôturer le soin" onClick={() => onUpdate(row, 'completed')}><CheckCircle2 className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" aria-label="Marquer non réalisé" onClick={() => onUpdate(row, 'not_done')}><XCircle className="h-4 w-4" /></Button>
                  </div>
                )}
                {canUpdate && onCorrect && <Button size="sm" variant="ghost" aria-label="Corriger le soin avec justification" onClick={() => onCorrect(row)}><Pencil className="h-4 w-4" /></Button>}
              </TableCell>
            </TableRow>
          ))}
          {care.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucun soin pour cette période.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

function VitalTrend({ data, dataKey, label, color }: {
  data: Array<{ time: string; temperature?: number; heartRate?: number; oxygenSaturation?: number }>;
  dataKey: 'temperature' | 'heartRate' | 'oxygenSaturation';
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

export default function NursingCarePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canWrite = user?.role === 'NURSE';
  const canConfigure = user?.role === 'HOSPITAL_ADMIN';
  const [dashboard, setDashboard] = useState<NursingDashboard | null>(null);
  const [patients, setPatients] = useState<NursingPatient[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<NursingPatientDetail | null>(null);
  const [care, setCare] = useState<NursingCare[]>([]);
  const [administrationSheet, setAdministrationSheet] = useState<MedicationAdministrationSheet | null>(null);
  const [missingReasons, setMissingReasons] = useState<Record<string, { reasonType: 'patient_absent' | 'patient_refused' | 'unavailable' | 'other'; reason: string }>>({});
  const [report, setReport] = useState<NursingReport | null>(null);
  const [thresholds, setThresholds] = useState<NursingThresholds | null>(null);
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [medicationDate, setMedicationDate] = useState(facilityDate());
  const [patientSearch, setPatientSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [careType, setCareType] = useState<NursingCareType>('monitoring');
  const [careDescription, setCareDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState(localDateTime());
  const [prescriptionLine, setPrescriptionLine] = useState('');
  const [vitalForm, setVitalForm] = useState<Record<string, string>>({});
  const [observation, setObservation] = useState('');

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [overview, carePage, reportData] = await Promise.all([
        nursingService.getDashboard(),
        nursingService.getCare({ date: selectedDate }),
        nursingService.getReport(),
      ]);
      const page = await nursingService.getPatients(patientSearch);
      setDashboard(overview);
      setPatients(page.data);
      setCare(carePage.data);
      setReport(reportData);
      setSelectedId((current) => current && page.data.some((patient) => patient.id === current) ? current : page.data[0]?.id ?? '');
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setIsLoading(false);
    }
  }, [patientSearch, selectedDate]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setIsDetailLoading(true);
    nursingService.getPatient(selectedId)
      .then((value) => { if (active) setDetail(value); })
      .catch((reason) => { if (active) setError(apiMessage(reason)); })
      .finally(() => { if (active) setIsDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setAdministrationSheet(null);
      return;
    }
    let active = true;
    nursingService.getAdministrations(selectedId, medicationDate)
      .then((sheet) => { if (active) setAdministrationSheet(sheet); })
      .catch((reason) => { if (active) setError(apiMessage(reason)); });
    return () => { active = false; };
  }, [selectedId, medicationDate]);

  useEffect(() => {
    if (!canConfigure) return;
    nursingService.getSettings().then(setThresholds).catch((reason) => setError(apiMessage(reason)));
  }, [canConfigure]);

  const selectedPatient = useMemo(() => patients.find((patient) => patient.id === selectedId), [patients, selectedId]);
  const medicationMetrics = useMemo(() => {
    const doses = administrationSheet?.doses ?? [];
    const now = Date.now();
    return {
      upcoming: doses.filter((dose) => dose.status === 'pending' && new Date(dose.scheduledAt).getTime() > now && new Date(dose.scheduledAt).getTime() <= now + 2 * 60 * 60_000).length,
      onTime: doses.filter((dose) => dose.status === 'administered_on_time').length,
      late: doses.filter((dose) => dose.status === 'administered_late').length,
      missed: doses.filter((dose) => dose.status === 'not_administered' || dose.status === 'patient_refused').length,
      suspended: doses.filter((dose) => dose.status === 'suspended').length,
    };
  }, [administrationSheet]);
  const chartData = useMemo(() => [...(detail?.vitals ?? [])].reverse().map((row) => ({
    time: new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(row.measuredAt)),
    temperature: row.temperature,
    heartRate: row.heartRate,
    oxygenSaturation: row.oxygenSaturation,
  })), [detail?.vitals]);
  const prescriptions = detail?.prescriptions ?? [];
  const prescriptionSelection = prescriptionLine.split('::');
  const chosenPrescription = prescriptions.find((item) => item.id === prescriptionSelection[0]);
  const chosenItem = chosenPrescription?.items.find((item) => item.id === prescriptionSelection[1]);

  const notifyError = (reason: unknown) => toast({ title: 'Opération impossible', description: apiMessage(reason), variant: 'destructive' });

  const submitCare = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    try {
      const [prescriptionId, prescriptionItemId] = prescriptionSelection;
      await nursingService.createCare({
        patientId: selectedId,
        type: careType,
        description: careDescription,
        scheduledAt: new Date(scheduledAt).toISOString(),
        ...(careType === 'medication' ? { prescriptionId, prescriptionItemId } : {}),
      });
      setCareDescription('');
      setPrescriptionLine('');
      toast({ title: 'Soin programmé', description: 'Le soin a été ajouté au planning infirmier.' });
      await reload();
    } catch (reason) { notifyError(reason); }
  };

  const correctCare = async (row: NursingCare) => {
    const reason = window.prompt('Justification de la correction (obligatoire)')?.trim();
    if (!reason) return;
    const description = window.prompt('Description corrigée', row.description);
    if (description === null) return;
    try {
      await nursingService.correctCare(row.id, { reason, description });
      toast({ title: 'Correction tracée', description: 'La modification et sa justification ont été ajoutées à l’historique.' });
      await reload();
      if (selectedId) setDetail(await nursingService.getPatient(selectedId));
    } catch (error) { notifyError(error); }
  };

  const submitVitals = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    const measurements = Object.fromEntries(
      Object.entries(vitalForm).filter(([, value]) => value.trim() !== '').map(([key, value]) => [key, Number(value)])
    );
    try {
      const newVital = await nursingService.createVitals({ patientId: selectedId, ...measurements });
      toast({
        title: 'Constantes enregistrées',
        description: newVital.alerts.length ? `Alerte de seuil : ${newVital.alerts.join(', ')}` : 'La mesure a été ajoutée au dossier.',
      });
      setVitalForm({});
      await reload();
      setDetail(await nursingService.getPatient(selectedId));
    } catch (reason) { notifyError(reason); }
  };

  const submitObservation = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    try {
      await nursingService.createObservation({ patientId: selectedId, content: observation });
      setObservation('');
      toast({ title: 'Observation ajoutée' });
      setDetail(await nursingService.getPatient(selectedId));
    } catch (reason) { notifyError(reason); }
  };

  const updateCare = async (row: NursingCare, status: 'completed' | 'not_done') => {
    const notDoneReason = status === 'not_done' ? window.prompt('Motif de non-réalisation (obligatoire)')?.trim() : undefined;
    if (status === 'not_done' && !notDoneReason) return;
    try {
      await nursingService.updateCare(row.id, { status, ...(notDoneReason ? { notDoneReason } : {}) });
      toast({ title: status === 'completed' ? 'Soin clôturé' : 'Soin non réalisé' });
      await reload();
      if (selectedId) setDetail(await nursingService.getPatient(selectedId));
    } catch (reason) { notifyError(reason); }
  };

  const refreshAdministrationSheet = async () => {
    if (selectedId) setAdministrationSheet(await nursingService.getAdministrations(selectedId, medicationDate));
  };

  const confirmAdministration = async (row: MedicationAdministration) => {
    const observations = window.prompt('Observation (facultative)');
    if (observations === null) return;
    try {
      await nursingService.confirmAdministration(row.id, observations.trim() || undefined);
      toast({ title: 'Administration enregistrée' });
      await refreshAdministrationSheet();
      await reload();
    } catch (reason) { notifyError(reason); }
  };

  const markAdministrationMissed = async (row: MedicationAdministration) => {
    const reasonType = missingReasons[row.id]?.reasonType;
    const reason = missingReasons[row.id]?.reason.trim();
    if (!reason) return;
    if (!reasonType) return;
    try {
      await nursingService.markAdministrationMissed(row.id, { reasonType, reason });
      toast({ title: 'Prise clôturée', description: 'Le motif a été conservé dans l’historique.' });
      await refreshAdministrationSheet();
      await reload();
    } catch (reasonError) { notifyError(reasonError); }
  };

  const correctAdministration = async (row: MedicationAdministration) => {
    const reason = window.prompt('Justification de la correction (obligatoire)')?.trim();
    if (!reason) return;
    const observations = window.prompt('Observations corrigées', row.observations ?? '');
    if (observations === null) return;
    try {
      await nursingService.correctAdministration(row.id, { reason, observations });
      toast({ title: 'Correction tracée' });
      await refreshAdministrationSheet();
    } catch (reasonError) { notifyError(reasonError); }
  };

  const saveThresholds = async () => {
    if (!thresholds) return;
    try {
      setThresholds(await nursingService.updateSettings(thresholds));
      toast({ title: 'Seuils mis à jour' });
      await reload();
    } catch (reason) { notifyError(reason); }
  };

  if (isLoading && !dashboard) return <div className="py-16 text-center text-muted-foreground">Chargement des données infirmières…</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Espace clinique</p>
          <h1 className="text-3xl font-bold tracking-tight">Soins infirmiers</h1>
          <p className="mt-1 text-muted-foreground">Surveillance, planification et traçabilité dans les dossiers médicaux existants.</p>
        </div>
        <Button variant="outline" onClick={() => void reload()} disabled={isLoading}><Activity className="mr-2 h-4 w-4" />Actualiser</Button>
      </div>

      {error && <Card className="border-destructive/50"><CardContent className="flex items-center gap-2 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{error}</CardContent></Card>}

      {dashboard && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard title="Patients sous surveillance" value={dashboard.stats.patientsUnderSurveillance} icon={UserRound} />
          <MetricCard title="Soins à effectuer aujourd’hui" value={dashboard.stats.careToPerform} icon={ClipboardList} />
          <MetricCard title="Soins réalisés aujourd’hui" value={dashboard.stats.careCompletedToday} icon={CheckCircle2} tone="text-green-600" />
          <MetricCard title="Soins en retard" value={dashboard.stats.overdueCare} icon={Clock3} tone="text-destructive" />
          <MetricCard title="Prescriptions à exécuter" value={dashboard.stats.prescriptionsWaiting} icon={FileText} />
          <MetricCard title="Surveillance particulière" value={dashboard.stats.patientsRequiringAttention} icon={AlertTriangle} tone="text-amber-600" />
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d’ensemble</TabsTrigger>
          <TabsTrigger value="patients">Patients et dossier</TabsTrigger>
          <TabsTrigger value="care">Soins</TabsTrigger>
          <TabsTrigger value="medications">Médicaments</TabsTrigger>
          <TabsTrigger value="vitals">Constantes</TabsTrigger>
          <TabsTrigger value="schedule">Planning</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="reports">Rapports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle>Patients hospitalisés et en observation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input aria-label="Rechercher un patient" placeholder="Rechercher par nom ou chambre" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} />
              <PatientTable patients={patients} selectedId={selectedId} onSelect={setSelectedId} />
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader><CardTitle>Soins programmés et en retard</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {dashboard?.dueItems.map((item) => {
                const patient = patients.find((row) => row.id === item.patientId);
                const overdue = new Date(item.scheduledAt).getTime() < Date.now() && (item.status === 'pending' || item.status === 'in_progress');
                return <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0">
                  <div><p className="font-medium">{displayDate(item.scheduledAt)} · {item.description}</p><p className="text-sm text-muted-foreground">{patient ? `${patient.firstName} ${patient.lastName}` : `Dossier ${item.patientId.slice(-8)}`}</p></div>
                  <Badge variant={overdue ? 'destructive' : statusVariants[item.status]}>{overdue ? 'En retard' : statusLabels[item.status]}</Badge>
                </div>;
              })}
              {!dashboard?.dueItems.length && <p className="text-sm text-muted-foreground">Aucun soin en attente aujourd’hui.</p>}
            </CardContent>
          </Card>
          {dashboard && <p className="text-xs text-muted-foreground">{dashboard.alertDisclaimer}</p>}
        </TabsContent>

        <TabsContent value="patients" className="space-y-4">
          <Card><CardHeader><CardTitle>Patients autorisés</CardTitle></CardHeader><CardContent className="space-y-3"><Input aria-label="Rechercher un patient" placeholder="Rechercher par nom ou chambre" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} /><PatientTable patients={patients} selectedId={selectedId} onSelect={setSelectedId} /></CardContent></Card>
          {selectedPatient && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedPatient.firstName} {selectedPatient.lastName}</CardTitle>
                <p className="text-sm text-muted-foreground">Dossier {selectedPatient.recordNumber} · {detail?.patient.gender === 'F' ? 'Femme' : detail?.patient.gender === 'M' ? 'Homme' : 'Sexe non renseigné'} · {selectedPatient.age !== undefined ? `${selectedPatient.age} ans` : 'Âge non renseigné'} · {detail?.patient.dateOfBirth ? `Née le ${new Intl.DateTimeFormat('fr-FR').format(new Date(detail.patient.dateOfBirth))}` : 'Date de naissance non renseignée'} · {selectedPatient.ward ?? 'Service non renseigné'} · Chambre {selectedPatient.room ?? '—'} · Médecin : {selectedPatient.doctor ?? '—'}</p>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                {isDetailLoading ? <p>Chargement du dossier…</p> : detail && <>
                  <section className="space-y-2">
                    <h3 className="font-semibold">Séjour hospitalier</h3>
                    {detail.hospitalization ? <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2">
                      <p>Admission : <strong>{displayDate(detail.hospitalization.admittedAt)}</strong></p>
                      <p>Durée : <strong>{detail.hospitalization.durationDays} jour(s)</strong></p>
                      <p>Service / chambre : <strong>{detail.hospitalization.ward ?? '—'} · {detail.hospitalization.room ?? '—'}</strong></p>
                      <p>Sortie prévue : <strong>{displayFacilityDate(detail.hospitalization.expectedDischargeAt)}</strong></p>
                      <p>Sortie réelle : <strong>{detail.hospitalization.dischargedAt ? displayMedicationDate(detail.hospitalization.dischargedAt, 'Africa/Kinshasa') : '—'}</strong></p>
                    </div> : <p className="text-sm text-muted-foreground">Aucun séjour hospitalier enregistré.</p>}
                    <h3 className="pt-2 font-semibold">Prescriptions médicales validées</h3>
                    {detail.prescriptions.length ? detail.prescriptions.map((prescription) => (
                      <div key={prescription.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{prescription.prescriberName} · {prescription.pharmacyStatus}</p>
                        {prescription.items.map((item) => <p key={item.id} className="text-muted-foreground">{item.medication} · {item.dosage} · {item.posology} · {item.duration} · {treatmentProgress(item.treatmentStartDate, item.treatmentEndDate)}{item.actualTreatmentEndAt ? ` · fin réelle ${displayMedicationDate(item.actualTreatmentEndAt, 'Africa/Kinshasa')}` : ''}{item.administrationTimes?.length ? ` · ${item.administrationTimes.join(', ')}` : ''}{item.instructions ? ` · ${item.instructions}` : ''}</p>)}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">Aucune prescription validée.</p>}
                    <h3 className="pt-2 font-semibold">Examens demandés</h3>
                    {detail.exams.map((exam) => <p key={exam.id} className="text-sm">{exam.name} · {exam.status} · {displayDate(exam.date)}</p>)}
                    <h3 className="pt-2 font-semibold">Dernières consultations</h3>
                    {detail.consultations.map((consultation, index) => <p key={`${consultation.date}-${index}`} className="text-sm">{displayDate(consultation.date)} · {consultation.doctorName} · {consultation.diagnosis || consultation.status}</p>)}
                  </section>
                  <section className="space-y-2">
                    <h3 className="font-semibold">Observations infirmières</h3>
                    {detail.observations.map((entry) => <div key={entry.id} className="rounded-lg bg-muted/50 p-3 text-sm"><p>{entry.content}</p><p className="mt-1 text-xs text-muted-foreground">{displayDate(entry.observedAt)}</p></div>)}
                    {!detail.observations.length && <p className="text-sm text-muted-foreground">Aucune observation enregistrée.</p>}
                    {canWrite && <form onSubmit={submitObservation} className="space-y-2">
                      <Label htmlFor="nursing-observation">Observation de passage</Label>
                      <Textarea id="nursing-observation" value={observation} onChange={(event) => setObservation(event.target.value)} required maxLength={3000} />
                      <Button type="submit" size="sm">Ajouter à l’historique</Button>
                    </form>}
                  </section>
                </>}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="care" className="space-y-4">
          {canWrite && <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Programmer un soin</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitCare} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2"><Label>Patient</Label><Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger><SelectValue placeholder="Sélectionner un patient" /></SelectTrigger><SelectContent>{patients.map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Type de soin</Label><Select value={careType} onValueChange={(value) => setCareType(value as NursingCareType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(careLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Date et heure prévues</Label><Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Description</Label><Input value={careDescription} onChange={(event) => setCareDescription(event.target.value)} required maxLength={2000} /></div>
                {careType === 'medication' && <>
                  <div className="space-y-2"><Label>Médicament prescrit</Label><Select value={prescriptionLine} onValueChange={setPrescriptionLine}><SelectTrigger><SelectValue placeholder="Choisir une prescription validée" /></SelectTrigger><SelectContent>{prescriptions.flatMap((prescription) => prescription.items.map((item) => <SelectItem key={`${prescription.id}::${item.id}`} value={`${prescription.id}::${item.id}`}>{item.medication} · {item.dosage} · {item.posology}</SelectItem>))}</SelectContent></Select></div>
                  <div className="self-end text-sm text-muted-foreground">{chosenItem ? `Dose et voie copiées de la prescription : ${chosenItem.dosage} · ${chosenItem.administrationRoute ?? 'non renseignée'}` : 'Sélectionnez une ligne prescrite. La prescription reste en lecture seule.'}</div>
                </>}
                <div className="sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={!selectedId}>Ajouter au planning</Button></div>
              </form>
            </CardContent>
          </Card>}
          <Card><CardHeader><CardTitle>Soins programmés pour le {new Intl.DateTimeFormat('fr-FR').format(new Date(`${selectedDate}T12:00:00`))}</CardTitle></CardHeader><CardContent><CareTable care={care} canUpdate={canWrite} onUpdate={(row, status) => void updateCare(row, status)} onCorrect={(row) => void correctCare(row)} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="medications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feuille quotidienne d’administration des médicaments</CardTitle>
              <p className="text-sm text-muted-foreground">Horaires prescrits en {administrationSheet?.timeZone ?? 'Africa/Kinshasa'} · Une prise non administrée devient clôturable après {administrationSheet?.lateWindowMinutes ?? 60} minutes.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label>Patient</Label><Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger><SelectValue placeholder="Sélectionner un patient" /></SelectTrigger><SelectContent>{patients.map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Date de la feuille</Label><Input type="date" value={medicationDate} onChange={(event) => setMedicationDate(event.target.value)} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard title="À administrer bientôt" value={medicationMetrics.upcoming} icon={Clock3} />
                <MetricCard title="Administrés à l’heure" value={medicationMetrics.onTime} icon={CheckCircle2} tone="text-green-600" />
                <MetricCard title="Administrés en retard" value={medicationMetrics.late} icon={Clock3} tone="text-amber-600" />
                <MetricCard title="Non administrés / refus" value={medicationMetrics.missed} icon={XCircle} tone="text-destructive" />
                <MetricCard title="Suspendus" value={medicationMetrics.suspended} icon={FileText} />
              </div>
              {administrationSheet?.unconfiguredItems.map((item, index) => <p key={`${item.prescriptionId}-${item.medication}-${index}`} className="text-sm text-amber-700">{item.medication} : {item.reason}. Aucune prise n’est générée.</p>)}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Horaire</TableHead><TableHead>Médicament / dose</TableHead><TableHead>Voie et consignes</TableHead><TableHead>Statut</TableHead><TableHead>Administration</TableHead><TableHead>Traçabilité</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(administrationSheet?.doses ?? []).map((row) => {
                      const future = new Date(row.scheduledAt).getTime() > Date.now();
                      return <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">{displayDate(row.scheduledAt)}</TableCell>
                        <TableCell><p className="font-medium">{row.medication}</p><p className="text-xs text-muted-foreground">{row.prescribedDose} · {row.posology}</p></TableCell>
                        <TableCell><p>{row.administrationRoute}</p><p className="max-w-xs whitespace-normal text-xs text-muted-foreground">{row.instructions || '—'}</p></TableCell>
                        <TableCell><Badge className={administrationStatusStyles[row.status]} variant="outline">{administrationStatusLabels[row.status]}</Badge></TableCell>
                        <TableCell className="min-w-52">
                          {canWrite && (row.status === 'pending' || row.status === 'not_administered') && <Button size="sm" variant="outline" disabled={future} aria-label={`Confirmer ${row.medication}`} onClick={() => void confirmAdministration(row)}><CheckCircle2 className="mr-2 h-4 w-4" />Administré</Button>}
                          {canWrite && (row.status === 'not_administered' || (row.status === 'pending' && !future)) && <div className="space-y-2">
                            <Select value={missingReasons[row.id]?.reasonType ?? ''} onValueChange={(value) => setMissingReasons((current) => ({ ...current, [row.id]: { reasonType: value as 'patient_absent' | 'patient_refused' | 'unavailable' | 'other', reason: current[row.id]?.reason ?? '' } }))}>
                              <SelectTrigger aria-label="Motif de non-administration"><SelectValue placeholder="Choisir un motif" /></SelectTrigger>
                              <SelectContent><SelectItem value="patient_absent">Patient absent</SelectItem><SelectItem value="patient_refused">Refus du patient</SelectItem><SelectItem value="unavailable">Médicament indisponible</SelectItem><SelectItem value="other">Autre motif</SelectItem></SelectContent>
                            </Select>
                            <Input aria-label="Détail du motif obligatoire" placeholder="Préciser le motif" value={missingReasons[row.id]?.reason ?? ''} onChange={(event) => setMissingReasons((current) => ({ ...current, [row.id]: { reasonType: current[row.id]?.reasonType ?? 'other', reason: event.target.value } }))} />
                            <Button size="sm" variant="destructive" disabled={!missingReasons[row.id]?.reasonType || !missingReasons[row.id]?.reason.trim() || (row.status === 'pending' && Date.now() <= new Date(row.scheduledAt).getTime() + (administrationSheet?.lateWindowMinutes ?? 60) * 60_000 && missingReasons[row.id]?.reasonType !== 'patient_refused')} onClick={() => void markAdministrationMissed(row)}>Enregistrer le motif</Button>
                          </div>}
                          {!canWrite && row.administeredAt && <p className="text-sm">{displayMedicationDate(row.administeredAt, administrationSheet?.timeZone ?? 'Africa/Kinshasa')}</p>}
                        </TableCell>
                        <TableCell className="min-w-48 text-sm">
                          {row.administeredByName && <p>{row.administeredByName}</p>}
                          {row.notDoneReason && <p className="text-destructive">{row.notDoneReason}</p>}
                          {row.observations && <p className="text-muted-foreground">{row.observations}</p>}
                          {row.history.map((entry, index) => <p key={`${entry.at}-${index}`} className="text-xs text-muted-foreground">{entry.action.split('_').join(' ')} · {displayMedicationDate(entry.at, administrationSheet?.timeZone ?? 'Africa/Kinshasa')}{entry.reason ? ` · ${entry.reason}` : ''}</p>)}
                          {canWrite && row.status !== 'pending' && <Button className="mt-1" size="sm" variant="ghost" onClick={() => void correctAdministration(row)}><Pencil className="mr-1 h-3 w-3" />Corriger</Button>}
                        </TableCell>
                      </TableRow>;
                    })}
                    {!administrationSheet?.doses.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucune prise structurée prescrite pour cette date.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vitals" className="space-y-4">
          {canWrite && <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5" />Enregistrer des constantes</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitVitals} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2 sm:col-span-2 lg:col-span-4"><Label>Patient</Label><Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger><SelectValue placeholder="Sélectionner un patient" /></SelectTrigger><SelectContent>{patients.map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</SelectItem>)}</SelectContent></Select></div>
                {[
                  ['systolic', 'Tension systolique (mmHg)', '40', '300'],
                  ['diastolic', 'Tension diastolique (mmHg)', '20', '200'],
                  ['temperature', 'Température (°C)', '25', '45'],
                  ['heartRate', 'Fréquence cardiaque (bpm)', '20', '300'],
                  ['respiratoryRate', 'Fréquence respiratoire (/min)', '1', '100'],
                  ['oxygenSaturation', 'SpO₂ (%)', '0', '100'],
                  ['weight', 'Poids (kg)', '0.1', '500'],
                  ['height', 'Taille (cm)', '20', '300'],
                  ['glucose', 'Glycémie (mg/dL)', '0', '1000'],
                ].map(([key, label, min, max]) => <div key={key} className="space-y-2"><Label htmlFor={`vital-${key}`}>{label}</Label><Input id={`vital-${key}`} type="number" step="any" min={min} max={max} value={vitalForm[key] ?? ''} onChange={(event) => setVitalForm((current) => ({ ...current, [key]: event.target.value }))} /></div>)}
                <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" disabled={!selectedId}>Enregistrer les mesures</Button></div>
              </form>
            </CardContent>
          </Card>}
          {selectedPatient && <Card>
            <CardHeader><CardTitle>Évolution des constantes · {selectedPatient.firstName} {selectedPatient.lastName}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 lg:grid-cols-3">
                <VitalTrend data={chartData} dataKey="temperature" label="Température (°C)" color="hsl(var(--primary))" />
                <VitalTrend data={chartData} dataKey="heartRate" label="Fréquence cardiaque (bpm)" color="#ef4444" />
                <VitalTrend data={chartData} dataKey="oxygenSaturation" label="SpO₂ (%)" color="#0ea5e9" />
              </div>
              {detail?.vitals.map((row) => <div key={row.id} className="border-t py-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><strong>{displayDate(row.measuredAt)}</strong><span>TA {row.systolic ?? '—'}/{row.diastolic ?? '—'} · T° {row.temperature ?? '—'} · FC {row.heartRate ?? '—'} · FR {row.respiratoryRate ?? '—'} · SpO₂ {row.oxygenSaturation ?? '—'}%</span></div>
                {(row.weight || row.height || row.glucose) && <p className="text-muted-foreground">Poids {row.weight ?? '—'} kg · Taille {row.height ?? '—'} cm · Glycémie {row.glucose ?? '—'}</p>}
                {row.alerts.length > 0 && <p className="mt-1 text-destructive">{row.alerts.join(' · ')} — alerte de seuil, pas un diagnostic.</p>}
                {row.observation && <p className="text-muted-foreground">{row.observation}</p>}
              </div>)}
            </CardContent>
          </Card>}
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />Planning quotidien</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="max-w-xs space-y-2"><Label htmlFor="schedule-date">Date</Label><Input id="schedule-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></div>
            <CareTable care={care} canUpdate={canWrite} onUpdate={(row, status) => void updateCare(row, status)} onCorrect={(row) => void correctCare(row)} />
            {dashboard && dashboard.stats.overdueCare > 0 && <p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{dashboard.stats.overdueCare} soin(s) en retard nécessitent une vérification.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card><CardHeader><CardTitle>Historique des soins</CardTitle></CardHeader><CardContent><CareTable care={detail?.care ?? care} canUpdate={canWrite} onUpdate={(row, status) => void updateCare(row, status)} onCorrect={(row) => void correctCare(row)} /></CardContent></Card>
          {detail && <Card><CardHeader><CardTitle>Historique infirmier et événements</CardTitle></CardHeader><CardContent className="space-y-3">
            {detail.observations.map((item) => <div key={item.id} className="flex gap-3 border-b pb-3 text-sm"><Stethoscope className="mt-0.5 h-4 w-4 text-primary" /><div><p>{item.content}</p><p className="text-xs text-muted-foreground">{displayDate(item.observedAt)}</p></div></div>)}
            {detail.exams.map((item) => <div key={item.id} className="flex gap-3 border-b pb-3 text-sm"><FileText className="mt-0.5 h-4 w-4 text-primary" /><p>Examen {item.name} · {item.status} · {displayDate(item.date)}</p></div>)}
            {!detail.observations.length && !detail.exams.length && <p className="text-sm text-muted-foreground">Aucun événement enregistré pour ce dossier.</p>}
          </CardContent></Card>}
        </TabsContent>

        <TabsContent value="reports">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle>Synthèse infirmière</CardTitle></CardHeader><CardContent className="space-y-2">
              <p>Soins enregistrés : <strong>{report?.totalCare ?? 0}</strong></p>
              <p>Observations : <strong>{report?.observations ?? 0}</strong></p>
              <p>Mesures de constantes : <strong>{report?.vitalMeasurements ?? 0}</strong></p>
              {Object.entries(report?.byStatus ?? {}).map(([status, count]) => <p key={status}>{statusLabels[status as NursingCareStatus] ?? status} : <strong>{count}</strong></p>)}
              {Object.entries(report?.byType ?? {}).map(([type, count]) => <p key={type}>{careLabels[type as NursingCareType] ?? type} : <strong>{count}</strong></p>)}
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Seuils d’alerte des constantes</CardTitle></CardHeader><CardContent>
              {canConfigure && thresholds ? <>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(thresholds) as Array<keyof NursingThresholds>).map((key) => <div key={key} className="space-y-1">
                    <Label htmlFor={`threshold-${key}`} className="text-xs">{key}</Label>
                    <Input id={`threshold-${key}`} type="number" step="any" value={thresholds[key]} onChange={(event) => setThresholds((current) => current ? { ...current, [key]: Number(event.target.value) } : current)} />
                  </div>)}
                </div>
                <Button className="mt-4" onClick={() => void saveThresholds()}>Enregistrer les seuils</Button>
              </> : <p className="text-sm text-muted-foreground">Seuils actuels chargés depuis la configuration de l’établissement. Seul l’administrateur peut les modifier.</p>}
              <p className="mt-3 text-xs text-muted-foreground">{dashboard?.alertDisclaimer}</p>
            </CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
      {selectedPatient && <p className="text-xs text-muted-foreground"><BedDouble className="mr-1 inline h-3 w-3" />{selectedPatient.status === 'hospitalized' ? 'Hospitalisation' : 'Observation'} · Accès soumis aux permissions de l’établissement.</p>}
    </div>
  );
}
