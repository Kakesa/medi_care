import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { getEnv } from './config/env.js';
import { dispatchShiftReminders } from './services/shift.service.js';
import { logger } from './utils/logger.js';

const env = getEnv();
const app = createApp();

connectDb(env.MONGODB_URI)
  .then(() => {
    app.listen(env.PORT, () => {
      logger.info({ msg: 'API MediCare démarrée', port: env.PORT });
      setInterval(() => {
        void dispatchShiftReminders().catch((error: unknown) => {
          logger.warn({ msg: 'Rappels de garde non envoyés', detail: error instanceof Error ? error.message : 'erreur' });
        });
      }, 60_000);
    });
  })
  .catch((error: unknown) => {
    logger.error({ msg: 'Démarrage impossible', detail: error instanceof Error ? error.message : 'erreur' });
    process.exit(1);
  });
