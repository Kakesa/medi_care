import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export async function connectDb(uri: string) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info({ msg: 'MongoDB connecté' });
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
