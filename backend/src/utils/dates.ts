export function dateOnly(value?: Date | string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString().slice(0, 10);
}

export function utcDayBounds(value: Date | string) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function minutesFromTime(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return 0;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function timesOverlap(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number
): boolean {
  const a = minutesFromTime(startA);
  const b = minutesFromTime(startB);
  return a < b + durationB && b < a + durationA;
}
