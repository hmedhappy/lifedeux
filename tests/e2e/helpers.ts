import { expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E_ENV } from "../../playwright.config";

export const db = new PrismaClient({ datasources: { db: { url: E2E_ENV.DATABASE_URL } } });

/** Alerts of the page, without Next's route announcer (also role="alert", it holds the page title). */
export const NOT_ANNOUNCER = '[role="alert"]:not(#__next-route-announcer__)';

export const DEMO_PASSWORD = "Demo12345!";

/** Password sign-in (folded under "Se connecter avec un mot de passe" since the email-code login). */
export async function login(page: Page, email: string, password: string, locale = "fr") {
  await page.goto(`/${locale}/login`);
  const form = page.locator("form:has([data-testid=password-login])");
  if (!(await form.locator('input[name="password"]').isVisible())) await page.locator("details:has([data-testid=password-login]) > summary").click();
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(password);
  await page.getByTestId("password-login").click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Confirms the sheet opened by a confirm button (replaces the old native dialogs). */
export async function confirmSheet(page: Page) {
  await page.getByTestId("confirm-sheet").getByRole("button").last().click();
}

/** A weekday at least `days` days from now, as YYYY-MM-DD. */
export function futureWeekday(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
