import { ApiError } from './ApiError.js';

const MAX_AMOUNT = 1_000_000_000;

export function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
    throw new ApiError(400, 'Le prix doit être un montant positif ou nul', 'VALIDATION_ERROR');
  }
  const minor = Math.round((amount * 100) + Number.EPSILON);
  const restored = minor / 100;
  if (Math.abs(restored - amount) > 0.001) {
    throw new ApiError(400, 'Le prix est limité à deux décimales', 'VALIDATION_ERROR');
  }
  return minor;
}

export function fromMinorUnits(minor: number): number {
  return minor / 100;
}
