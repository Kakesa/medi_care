import dotenv from 'dotenv';

dotenv.config();

export function getEnv() {
  const JWT_SECRET = process.env.JWT_SECRET ?? '';
  if (JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET doit contenir au moins 32 caractères.');
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI est requis.');
  }

  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  return {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PORT: Number(process.env.PORT ?? 3001),
    MONGODB_URI,
    JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '8h',
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:8080',
    BCRYPT_ROUNDS: Number.isFinite(rounds) && rounds >= 4 ? rounds : 12,
    LOGIN_RATE_LIMIT_MAX: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 10),
  };
}
