import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { getEnv } from '../config/env.js';

export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      next(new ApiError(400, issue?.message || 'Données invalides', 'VALIDATION_ERROR'));
      return;
    }

    const data = parsed.data as { body?: unknown; query?: unknown; params?: unknown };
    if (data.body !== undefined) {
      req.body = data.body;
    }
    if (data.query !== undefined) {
      req.query = data.query as Request['query'];
    }
    if (data.params !== undefined) {
      req.params = data.params as Request['params'];
    }
    next();
  };
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: error.issues[0]?.message || 'Données invalides',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  if (error instanceof ApiError) {
    if (error.status >= 500) {
      logger.error({ msg: error.message, path: req.path, code: error.code });
    }
    res.status(error.status).json({
      success: false,
      message: error.message,
      code: error.code,
    });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    res.status(404).json({ success: false, message: 'Ressource introuvable', code: 'NOT_FOUND' });
    return;
  }

  if (typeof error === 'object' && error && 'code' in error && (error as { code?: number }).code === 11000) {
    res.status(409).json({ success: false, message: 'Cette valeur existe déjà', code: 'DUPLICATE' });
    return;
  }

  const env = getEnv();
  logger.error({
    msg: 'Erreur interne',
    path: req.path,
    detail: env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
  });

  res.status(500).json({ success: false, message: 'Erreur interne du serveur', code: 'INTERNAL' });
}
