import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getEnv } from './config/env.js';
import { errorHandler } from './middlewares/validate.middleware.js';
import routes from './routes/index.js';

export function createApp() {
  const env = getEnv();
  const app = express();

  app.disable('x-powered-by');
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
    app.use((req, res, next) => {
      if (req.secure) return next();
      const host = req.headers.host;
      if (!host) return next();
      res.redirect(301, `https://${host}${req.originalUrl}`);
    });
  }
  app.use(helmet({
    hsts: env.NODE_ENV === 'production'
      ? { maxAge: 15_552_000, includeSubDomains: true }
      : false,
  }));
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: false }));
  app.use(express.json({ limit: '8mb' }));

  app.use('/api', routes);
  app.use(errorHandler);

  return app;
}
