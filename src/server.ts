import { createApp } from './app';

const portValue = process.env.PORT;
const PORT = portValue ? Number(portValue) : 3000;

if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error(`PORT must be a positive integer. Received "${portValue}".`);
}

const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
