import { defineConfig, devices } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000";
const CLIENT_URL = process.env.E2E_CLIENT_URL ?? "http://localhost:3000";
const TEST_DB =
  process.env.TEST_DATABASE_URL ??
  "postgresql://marketplace:marketplace@localhost:5432/marketplace_test";

/**
 * Browser-level E2E suite. The API and client are started as web servers and
 * pointed at the PostgreSQL/Redis test services. `npm run test:e2e` requires
 * `@playwright/test` and Chromium to be installed (see docs/E2E.md).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: CLIENT_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev --prefix ../server",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        PORT: "4000",
        CLIENT_URL,
        // Both URLs point at the test database: the API uses DATABASE_URL and
        // the seed helper uses TEST_DATABASE_URL.
        DATABASE_URL: TEST_DB,
        TEST_DATABASE_URL: TEST_DB,
        REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
        EMAIL_PROVIDER: "memory",
        SMS_PROVIDER: "memory",
        STORAGE_PROVIDER: "memory",
        JWT_ACCESS_SECRET: "e2e-access-secret-at-least-32-characters-long",
        WEBHOOK_SECRET:
          process.env.E2E_WEBHOOK_SECRET ?? "e2e-webhook-secret-change-me",
        LOG_LEVEL: "silent",
      },
    },
    {
      command: "npm run dev",
      url: CLIENT_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: API_URL },
    },
  ],
});
