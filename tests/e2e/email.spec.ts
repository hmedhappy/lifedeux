import { expect, test } from "@playwright/test";
import { db, login } from "./helpers";
import { mailboxAddress, mailboxConfigured, waitForMail } from "./mailbox";

// Real emails through Gmail (SMTP out, IMAP in). Set E2E_GMAIL_USER and E2E_GMAIL_APP_PASSWORD in .env.e2e.local.
test.skip(!mailboxConfigured, "No test mailbox: add .env.e2e.local to run the email tests");
test.setTimeout(150_000);

test("the login code arrives by email and signs a new visitor in", async ({ page }) => {
  const email = mailboxAddress("code");
  await page.goto("/fr/login");
  const panel = page.getByTestId("auth-panel");
  await panel.getByTestId("auth-email").fill(email);
  await panel.getByTestId("auth-send-code").click();
  await expect(panel.getByTestId("auth-code")).toBeVisible();

  const mail = await waitForMail(email);
  const code = mail.subject.match(/\b(\d{6})\b/)?.[1];
  expect(code, `code in "${mail.subject}"`).toBeTruthy();
  expect(mail.subject).toContain("Medelys");
  expect(mail.html).toContain("/brand/logo-horizontal.png");

  await panel.getByTestId("auth-code").fill(code!);
  await panel.getByTestId("auth-verify").click();
  await panel.getByTestId("auth-first-name").fill("Mail");
  await panel.getByTestId("auth-last-name").fill("Test");
  await panel.getByTestId("auth-consent").check();
  await panel.getByTestId("auth-create").click();
  await expect(page).not.toHaveURL(/\/login/);
  expect((await db.user.findUniqueOrThrow({ where: { email: email.toLowerCase() } })).role).toBe("PATIENT");
});

test("the password reset link from the email sets a new password", async ({ page }) => {
  const email = mailboxAddress("reset");
  await page.goto("/fr/register");
  await page.locator('input[name="firstName"]').fill("Lina");
  await page.locator('input[name="lastName"]').fill("Mail");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="phone"]').fill("+216 20 000 000");
  await page.locator('input[name="country"]').fill("Tunisie");
  await page.locator('input[name="password"]').fill("OldPassword1!");
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/fr\/account$/);
  await page.context().clearCookies();

  await page.goto("/fr/forgot");
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Si un compte existe" })).toBeVisible();

  const mail = await waitForMail(email);
  const path = mail.html.match(/href="https?:\/\/[^/"]+(\/fr\/reset\/[^"]+)"/)?.[1];
  expect(path, "reset link in the email").toBeTruthy();
  await page.goto(path!);
  await page.locator('input[name="password"]').fill("NewPassword1!");
  await page.locator('input[name="confirm"]').fill("NewPassword1!");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page).toHaveURL(/\/fr\/account$/);

  await page.context().clearCookies();
  await login(page, email, "NewPassword1!");
  await expect(page).toHaveURL(/\/fr\/account$/);
});
