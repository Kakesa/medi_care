import jwt, { type SignOptions } from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { ApiError } from './ApiError.js';

export interface AccessTokenPayload {
  sub: string;
  tv: number;
}

export function signAccessToken(userId: string, tokenVersion: number) {
  const env = getEnv();
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return jwt.sign({ sub: userId, tv: tokenVersion }, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const env = getEnv();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !decoded.sub || typeof decoded.tv !== 'number') {
      throw new ApiError(401, 'Session invalide', 'INVALID_TOKEN');
    }
    return { sub: decoded.sub, tv: decoded.tv };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, 'Session invalide ou expirée', 'INVALID_TOKEN');
  }
}
