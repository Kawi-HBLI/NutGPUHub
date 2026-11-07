import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

if (existsSync('.env')) process.loadEnvFile('.env');
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL to a separate, migrated PostgreSQL database before running E2E tests.');
}

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The browser journeys run against the built app and the separate test database.
  webServer: {
    command: 'npm run build && node dist/server/index.js',
    url: `${baseURL}/api/v1/auth/me`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      APP_ORIGIN: baseURL,
      PORT: String(port),
      HOST: '127.0.0.1',
      SESSION_TTL_MINUTES: '60',
      COOKIE_SECURE: 'false',
    },
  },
});
