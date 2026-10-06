import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_PORT = 3000;

function readPort(): number {
  const raw = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer. Received "${raw}".`);
  }
  return port;
}

function readMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (typeof uri !== 'string' || uri.trim().length === 0) {
    throw new Error(
      'MONGODB_URI must be set. Copy .env.example to .env and start MongoDB before launching the API.',
    );
  }
  return uri.trim();
}

/**
 * Process configuration. Connection strings and the listen port are read here
 * so the rest of the application does not hardcode them.
 */
export const config = {
  port: readPort(),
  mongoUri: readMongoUri(),
};
