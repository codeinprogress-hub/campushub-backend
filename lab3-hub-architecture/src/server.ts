import { createApp } from './app';
import { config } from './config';

async function main(): Promise<void> {
  const app = await createApp();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${config.port}`);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Failed to start server.';
  console.error(message);
  process.exit(1);
});
