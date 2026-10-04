import { expect, test } from "@playwright/test";
import { E2E_ENV } from "../../playwright.config";
import { db, login } from "./helpers";

const email = `dr.onboard.${Date.now()}@test.dev`;

test("admin invites a doctor by email, who signs up in three steps", async ({ browser }) => {
  const admin = await (await browser.newContext()).newPage();
  await login(admin, E2E_ENV.ADMIN_EMAIL, E2E_ENV.ADMIN_PASSWORD);
  await admin.goto("/fr/admin/doctors");
  await admin.getByTestId("doctor-invite-email").fill(email);
  await admin.getByTestId("doctor-invite-send").click();
  await expect(admin.getByTestId("doctor-invite")).toContainText(email);

  const invite = await db.doctorInvite.findFirstOrThrow({ where: { email } });
  const doctor = await (await browser.newContext()).newPage();
  await doctor.goto(`/fr/onboard/${invite.token}`);
  await expect(doctor.getByTestId("onboard-email")).toHaveValue(email);

  // Step 1: identity.
  await doctor.locator('input[name="firstName"]').fill("Sami");
  await doctor.locator('input[name="lastName"]').fill("Onboard");
  await doctor.getByTestId("step-next").click();

  // Step 2: specialty and clinic (the address is typed; the map is optional).
  await doctor.locator('select[name="specialtyId"]').selectOption({ index: 1 });
  await expect(doctor.getByTestId("mode-both")).toHaveAttribute("aria-checked", "true");
  await doctor.getByTestId("clinic-address").fill("12 avenue Habib Bourguiba");
  await doctor.locator('input[name="city"]').fill("Tunis");
  await doctor.getByTestId("step-next").click();

  // Step 3: both fees.
  await doctor.locator('input[name="onlinePrice"]').fill("40");
  await doctor.locator('input[name="clinicPrice"]').fill("50");
  await doctor.locator('input[name="consent"]').check();
  await doctor.getByTestId("onboard-submit").click();

  await expect(doctor).toHaveURL(/\/fr\/doctor\?welcome=1$/);
  await expect(doctor.getByRole("status").filter({ hasText: "Bienvenue sur Medelys" })).toBeVisible();
  // Online consultations wait for the stamp.
  await expect(doctor.getByRole("status").filter({ hasText: "Cachet manquant" })).toBeVisible();

  const created = await db.doctor.findFirstOrThrow({ where: { user: { email } } });
  expect(created).toMatchObject({ consultationPrice: 4000, inPersonPrice: 5000, offersInPerson: true, offersConsultation: true, city: "Tunis" });

  // The link works only once.
  const again = await (await browser.newContext()).newPage();
  await again.goto(`/fr/onboard/${invite.token}`);
  await expect(again.getByRole("alert").filter({ hasText: "n'est plus valable" })).toBeVisible();
});
