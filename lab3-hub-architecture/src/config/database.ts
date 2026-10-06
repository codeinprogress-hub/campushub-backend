import mongoose from 'mongoose';
import { ensureSeedCatalog } from '../services/resource.service';
import { config } from './index';

const SERVER_SELECTION_TIMEOUT_MS = 5000;

/**
 * Opens the MongoDB connection named by `MONGODB_URI` and ensures the Lab 2
 * resource catalog exists. Safe to call again once the connection is open.
 */
export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    });
  }

  await ensureSeedCatalog();
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
