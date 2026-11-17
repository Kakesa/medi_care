import { describe, expect, it } from 'vitest';
import { durationLabel, rangesOverlap, restDates, rotationDates, rotationTurn, shiftBounds } from '../src/services/shift.logic.js';

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

  it('fait tourner un infirmier par tranche de 24 h', () => {
    expect(rotationTurn(0, 1, 2, 3)).toBe(0);
    expect(rotationTurn(1, 1, 2, 3)).toBe(2);
    expect(rotationTurn(2, 1, 2, 3)).toBe(1);
    expect(rotationDates('2026-11-14', '2026-11-17', 1, 2, rotationTurn(0, 1, 2, 3))).toEqual(['2026-11-14', '2026-11-17']);
    expect(rotationDates('2026-11-14', '2026-11-17', 1, 2, rotationTurn(1, 1, 2, 3))).toEqual(['2026-11-15']);
    expect(rotationDates('2026-11-14', '2026-11-17', 1, 2, rotationTurn(2, 1, 2, 3))).toEqual(['2026-11-16']);
    expect(rotationTurn(1, 2, 2, 2)).toBe(2);
  });

  it('calcule la durée, y compris quand la garde passe minuit', () => {
    expect(durationLabel('07:00', '07:00')).toBe('24 heures');
    expect(durationLabel('06:00', '18:00')).toBe('12 heures');
    expect(durationLabel('18:00', '06:00')).toBe('12 heures');
    expect(durationLabel('06:00', '14:00')).toBe('8 heures');
    expect(durationLabel('22:00', '06:00')).toBe('8 heures');
    expect(durationLabel('08:30', '10:00')).toBe('1 h 30');
  });

  it('calcule les jours de repos sur la période affichée', () => {
    expect(restDates('2026-11-14', '2026-11-17', ['2026-11-14', '2026-11-15'])).toEqual([
      '2026-11-16', '2026-11-17',
    ]);
  });
});
