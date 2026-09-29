import { expect, test } from "@playwright/test";
import { E2E_ENV } from "../../playwright.config";
import { db, login } from "./helpers";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("a patient can reset a forgotten password", async ({ page }) => {
  const email = `reset.${Date.now()}@test.dev`;
  await page.goto("/fr/register");
  await page.locator('input[name="firstName"]').fill("Lina");
  await page.locator('input[name="lastName"]').fill("Reset");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="phone"]').fill("+216 20 000 000");
  await page.locator('input[name="country"]').fill("Tunisie");
  await page.locator('input[name="password"]').fill("OldPassword1!");
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/fr\/account$/);
  await page.context().clearCookies();

  await page.goto("/fr/login");
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  // The login page also has an email field: wait for the navigation before typing.
  await expect(page).toHaveURL(/\/fr\/forgot$/);
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Si un compte existe" })).toBeVisible();

  // Unknown emails get exactly the same answer.
  await page.goto("/fr/forgot");
  await page.locator('input[name="email"]').fill("nobody@test.dev");
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Si un compte existe" })).toBeVisible();

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  expect(user.inviteToken).toBeTruthy();
  await page.goto(`/fr/reset/${user.inviteToken}`);
  await page.locator('input[name="password"]').fill("NewPassword1!");
  await page.locator('input[name="confirm"]').fill("NewPassword1!");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page).toHaveURL(/\/fr\/account$/);

  // The link works only once, and the new password is the one that counts.
  await page.goto(`/fr/reset/${user.inviteToken}`);
  await expect(page.getByText("Ce lien est invalide ou a expiré.")).toBeVisible();
  await page.context().clearCookies();
  await login(page, email, "NewPassword1!");
  await expect(page).toHaveURL(/\/fr\/account$/);
});

test("admin uploads stay photos; fake images are rejected", async ({ page }) => {
  await login(page, E2E_ENV.ADMIN_EMAIL, E2E_ENV.ADMIN_PASSWORD);
  const title = `Logement photo ${Date.now()}`;

  await page.goto("/fr/admin/stays/new");
  await page.locator('input[name="title"]').fill(title);
  await page.locator('input[name="city"]').fill("Tunis");
  await page.locator('input[name="address"]').fill("Centre");
  await page.locator('input[name="pricePerNight"]').fill("50");
  await page.locator('textarea[name="description"]').fill("Avec photo.");
  await page.locator('input[name="photoFiles"]').setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Format d'image non accepté" })).toBeVisible();

  await page.locator('input[name="photoFiles"]').setInputFiles({ name: "room.png", mimeType: "image/png", buffer: PNG_1PX });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/fr\/admin\/stays$/);

  const stay = await db.accommodation.findFirstOrThrow({ where: { title } });
  expect(stay.photos).toHaveLength(1);
  expect(stay.photos[0]).toMatch(/^\/api\/images\/\w+$/);

  const res = await page.request.get(stay.photos[0]);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  expect((await res.body()).equals(PNG_1PX)).toBe(true);

  await page.goto("/fr/stays");
  await expect(page.locator(`img[alt="${title}"]`)).toHaveAttribute("src", stay.photos[0]);
});
