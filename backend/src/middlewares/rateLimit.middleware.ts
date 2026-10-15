import rateLimit from 'express-rate-limit';

export function buildLoginRateLimiter(max = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 10)) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Trop de tentatives. Réessayez plus tard.',
      code: 'RATE_LIMITED',
    },
  });
}
