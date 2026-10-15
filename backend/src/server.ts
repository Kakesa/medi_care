import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { getEnv } from './config/env.js';
import { logger } from './utils/logger.js';

const env = getEnv();
const app = createApp();

connectDb(env.MONGODB_URI)
  .then(() => {
    app.listen(env.PORT, () => {
      logger.info({ msg: 'API MediCare démarrée', port: env.PORT });
    });
  })
  .catch((error: unknown) => {
    logger.error({ msg: 'Démarrage impossible', detail: error instanceof Error ? error.message : 'erreur' });
    process.exit(1);
  });
