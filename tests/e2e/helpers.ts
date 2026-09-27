import { expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E_ENV } from "../../playwright.config";

export const db = new PrismaClient({ datasources: { db: { url: E2E_ENV.DATABASE_URL } } });

export const DEMO_PASSWORD = "Demo12345!";

export async function login(page: Page, email: string, password: string, locale = "fr") {
  await page.goto(`/${locale}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** A weekday at least `days` days from now, as YYYY-MM-DD. */
export function futureWeekday(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
