import { httpClient } from './httpClient';

export type ShiftStatus = 'draft' | 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export type NurseShift = {
  id: string;
  nurseId: string;
  nurseName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  durationLabel: string;
  ward: string;
  status: ShiftStatus;
  absent: boolean;
  absenceReason: string;
  conflict?: boolean;
  actualStartedAt?: string;
  actualEndedAt?: string;
  handoverNote: string;
  handoverSummary: string;
};

export type ShiftTemplate = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  durationLabel: string;
  ward: string;
  requiredNurses: number;
  active: boolean;
};

export type ShiftCycle = {
  id: string;
  name: string;
  workDays: number;
  restDays: number;
};

export type ShiftBoard = {
  today: NurseShift[];
  next: NurseShift | null;
  upcoming: NurseShift[];
  history: NurseShift[];
  restDays: string[];
  handover: { note: string; summary: string; date: string; ward: string } | null;
};

const base = '/shifts';

class ShiftService {
  staff() {
    return httpClient.get<Array<{ id: string; name: string }>>(`${base}/staff`);
  }

  list(from: string, to: string) {
    return httpClient.get<NurseShift[]>(base, { from, to });
  }

  create(input: { nurseIds: string[]; date: string; startTime: string; endTime: string; type: string; ward: string }) {
    return httpClient.post<NurseShift[]>(base, input);
  }

  rotation(input: { nurseIds: string[]; from: string; to: string; workDays: number; restDays: number; startTime: string; endTime: string; type: string; ward: string }) {
    return httpClient.post<NurseShift[]>(`${base}/rotations`, input);
  }

  update(id: string, input: { date: string; startTime: string; endTime: string; type: string; ward: string; status?: 'draft' | 'scheduled' | 'confirmed' | 'cancelled' }) {
    return httpClient.patch<NurseShift>(`${base}/${id}`, input);
  }

  publish(from: string, to: string) {
    return httpClient.post<NurseShift[]>(`${base}/publish`, { from, to });
  }

  copy(from: string, to: string, targetFrom: string) {
    return httpClient.post<{ created: NurseShift[]; skipped: Array<{ nurseName: string; date: string; startTime: string; endTime: string }> }>(`${base}/copy`, { from, to, targetFrom });
  }

  templates() {
    return httpClient.get<ShiftTemplate[]>(`${base}/templates`);
  }

  saveTemplate(input: { name: string; startTime: string; endTime: string; ward: string; requiredNurses: number }, id?: string) {
    return id ? httpClient.patch<ShiftTemplate>(`${base}/templates/${id}`, input) : httpClient.post<ShiftTemplate>(`${base}/templates`, input);
  }

  deleteTemplate(id: string) {
    return httpClient.delete(`${base}/templates/${id}`);
  }

  cycles() {
    return httpClient.get<ShiftCycle[]>(`${base}/cycles`);
  }

  saveCycle(input: { name: string; workDays: number; restDays: number }, id?: string) {
    return id ? httpClient.patch<ShiftCycle>(`${base}/cycles/${id}`, input) : httpClient.post<ShiftCycle>(`${base}/cycles`, input);
  }

  deleteCycle(id: string) {
    return httpClient.delete(`${base}/cycles/${id}`);
  }

  absence(id: string, reason: string) {
    return httpClient.post<NurseShift>(`${base}/${id}/absence`, { reason });
  }

  replace(id: string, nurseId: string, reason: string) {
    return httpClient.post<NurseShift>(`${base}/${id}/replacement`, { nurseId, reason });
  }

  mine() {
    return httpClient.get<ShiftBoard>(`${base}/mine`);
  }

  start(id: string) {
    return httpClient.post<NurseShift>(`${base}/${id}/start`, {});
  }

  end(id: string, note: string) {
    return httpClient.post<NurseShift>(`${base}/${id}/end`, { note });
  }

  pushKey() {
    return httpClient.get<{ publicKey: string }>(`${base}/push-key`);
  }

  subscribe(input: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return httpClient.post<{ ok: boolean }>(`${base}/push-subscription`, input);
  }
}

export const shiftService = new ShiftService();
