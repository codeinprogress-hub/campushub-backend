import { defineConfig, devices } from '@playwright/test';

const apiUrl = 'http://127.0.0.1:3000/api/v1/resources';
const clientUrl = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: clientUrl,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: apiUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        E2E: '1',
        PORT: '3000',
      },
    },
    {
      command: 'npm run dev -w client',
      url: clientUrl,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
