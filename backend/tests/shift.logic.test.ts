import { describe, expect, it } from 'vitest';
import { rangesOverlap, restDates, rotationDates, shiftBounds } from '../src/services/shift.logic.js';

describe('rotations de garde', () => {
  it('alterne 2 jours de travail et 2 jours de repos', () => {
    expect(rotationDates('2026-11-14', '2026-11-21', 2, 2, 0)).toEqual([
      '2026-11-14', '2026-11-15', '2026-11-18', '2026-11-19',
    ]);
    expect(rotationDates('2026-11-14', '2026-11-21', 2, 2, 2)).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-20', '2026-11-21',
    ]);
  });

  it('refuse le chevauchement du même infirmier et laisse passer deux équipes successives', () => {
    const night = shiftBounds('2026-11-14', '22:00', '06:00');
    const nextMorning = shiftBounds('2026-11-15', '06:00', '14:00');
    const overlap = shiftBounds('2026-11-15', '05:00', '12:00');
    expect(rangesOverlap(night, nextMorning)).toBe(false);
    expect(rangesOverlap(night, overlap)).toBe(true);
  });

  it('calcule les jours de repos sur la période affichée', () => {
    expect(restDates('2026-11-14', '2026-11-17', ['2026-11-14', '2026-11-15'])).toEqual([
      '2026-11-16', '2026-11-17',
    ]);
  });
});
