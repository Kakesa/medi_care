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
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: false }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', routes);
  app.use(errorHandler);

  return app;
}
