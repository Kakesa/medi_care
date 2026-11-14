import { httpClient } from './httpClient';

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'full_day';
export type ShiftStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export type NurseShift = {
  id: string;
  nurseId: string;
  nurseName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: ShiftType;
  ward: string;
  status: ShiftStatus;
  absent: boolean;
  absenceReason: string;
  actualStartedAt?: string;
  actualEndedAt?: string;
  handoverNote: string;
  handoverSummary: string;
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

  create(input: { nurseIds: string[]; date: string; startTime: string; endTime: string; type: ShiftType; ward: string }) {
    return httpClient.post<NurseShift[]>(base, input);
  }

  rotation(input: { nurseIds: string[]; from: string; to: string; workDays: number; restDays: number; startTime: string; endTime: string; type: ShiftType; ward: string }) {
    return httpClient.post<NurseShift[]>(`${base}/rotations`, input);
  }

  update(id: string, input: { date: string; startTime: string; endTime: string; type: ShiftType; ward: string; status?: 'scheduled' | 'confirmed' | 'cancelled' }) {
    return httpClient.patch<NurseShift>(`${base}/${id}`, input);
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
