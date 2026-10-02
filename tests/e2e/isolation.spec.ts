import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, db, login } from "./helpers";

/** Two patients ask the same doctor; refusing one request must not touch the other. */
test("refusing one patient's request leaves the other patient's request untouched", async ({ browser }) => {
  const doc = await db.doctor.findFirstOrThrow({ where: { user: { email: "dr.gharbi@demo.lifedeux.com" } } });
  const refs: Record<string, string> = {};

  for (const email of ["nadia@demo.lifedeux.com", "patient@demo.lifedeux.com"]) {
    const page = await (await browser.newContext()).newPage();
    await login(page, email, DEMO_PASSWORD);
    await page.goto(`/fr/doctors/${doc.id}?service=operation`);
    await page.locator("[data-testid=slot-times] button").first().click();
    await page.getByTestId("booking-consent").check();
    await page.getByRole("button", { name: "Demander ce rendez-vous" }).click();
    await expect(page).toHaveURL(/requested=1/);
    const id = page.url().split("/bookings/")[1].split("?")[0];
    refs[email] = (await db.booking.findUniqueOrThrow({ where: { id } })).reference;
  }

  const doctor = await (await browser.newContext()).newPage();
  await login(doctor, "dr.gharbi@demo.lifedeux.com", DEMO_PASSWORD);
  // The inbox shows first name and initial; the detail names the reference.
  await doctor.getByTestId("inbox-row").filter({ hasText: "Nadia B." }).click();
  await doctor.getByTestId("inbox-refuse").click();
  const reasons = doctor.getByTestId("inbox-refuse-sheet");
  // Closing the reason sheet changes nothing.
  await doctor.keyboard.press("Escape");
  await expect(reasons).toHaveCount(0);
  expect((await db.booking.findUniqueOrThrow({ where: { reference: refs["nadia@demo.lifedeux.com"] } })).status).toBe("REQUESTED");

  await doctor.getByTestId("inbox-row").filter({ hasText: "Nadia B." }).click();
  await doctor.getByTestId("inbox-refuse").click();
  await reasons.getByRole("button", { name: "Je ne suis pas disponible" }).click();
  await doctor.getByTestId("inbox-refuse-send").click();
  await expect
    .poll(async () => (await db.booking.findUniqueOrThrow({ where: { reference: refs["nadia@demo.lifedeux.com"] } })).status, { timeout: 10_000 })
    .toBe("REFUSED");

  const [nadia, jean] = await Promise.all(
    [refs["nadia@demo.lifedeux.com"], refs["patient@demo.lifedeux.com"]].map((reference) => db.booking.findUniqueOrThrow({ where: { reference } })),
  );
  expect(nadia.status).toBe("REFUSED");
  expect(jean.status).toBe("REQUESTED");

  const other = await (await browser.newContext()).newPage();
  await login(other, "patient@demo.lifedeux.com", DEMO_PASSWORD);
  const mine = other.getByTestId("booking-card").filter({ hasText: jean.reference });
  await expect(mine).toContainText("En attente de confirmation");
  await expect(other.getByTestId("booking-card").filter({ hasText: nadia.reference })).toHaveCount(0);
});
