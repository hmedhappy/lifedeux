import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_ENV = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://lifedeux:lifedeux@localhost:5432/lifedeux_test",
  AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret",
  APP_URL: `http://localhost:${PORT}`,
  PAYMENT_MOCK: "true",
  STRIPE_WEBHOOK_SECRET: "whsec_e2e_test_secret",
  CRON_SECRET: "e2e-cron",
  ADMIN_EMAIL: "admin@e2e.test",
  ADMIN_PASSWORD: "Admin12345!",
  SEED_DEMO: "true",
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Applies migrations and the idempotent seed (nothing is deleted), then serves the production build.
    // Run `npm run build` first. Tests use unique data, so they can be re-run on the same database.
    command: `npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/fr`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: E2E_ENV,
  },
});
