const timeZone = 'Africa/Kinshasa';

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'full_day';

export function facilityDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function formatShiftDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00.000Z`));
}

export function shiftInstant(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(localAsUtc));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute),
  );
  return new Date(localAsUtc - (representedAsUtc - localAsUtc));
}

export function shiftBounds(date: string, startTime: string, endTime: string) {
  const start = shiftInstant(date, startTime);
  const end = shiftInstant(endTime <= startTime ? addDays(date, 1) : date, endTime);
  return { start, end };
}

export function rangesOverlap(left: { start: Date; end: Date }, right: { start: Date; end: Date }) {
  return left.start < right.end && right.start < left.end;
}

export function rotationDates(from: string, to: string, workDays: number, restDays: number, offset = 0) {
  const dates: string[] = [];
  const cycle = workDays + restDays;
  let cursor = from;
  let index = 0;
  while (cursor <= to) {
    if ((index + offset) % cycle < workDays) dates.push(cursor);
    cursor = addDays(cursor, 1);
    index += 1;
  }
  return dates;
}

export function restDates(from: string, to: string, worked: string[]) {
  const busy = new Set(worked);
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    if (!busy.has(cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}
