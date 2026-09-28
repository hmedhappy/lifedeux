import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, db, login } from "./helpers";

/** Two patients ask the same doctor; refusing one request must not touch the other. */
test("refusing one patient's request leaves the other patient's request untouched", async ({ browser }) => {
  const doc = await db.doctor.findFirstOrThrow({ where: { user: { email: "dr.gharbi@demo.lifedeux.com" } } });
  const refs: Record<string, string> = {};

  for (const email of ["nadia@demo.lifedeux.com", "patient@demo.lifedeux.com"]) {
    const page = await (await browser.newContext()).newPage();
    await login(page, email, DEMO_PASSWORD);
    await page.goto(`/fr/doctors/${doc.id}`);
    await page.locator("[data-testid=slot-times] button").first().click();
    await page.getByRole("button", { name: "Demander ce rendez-vous" }).click();
    await expect(page).toHaveURL(/requested=1/);
    const id = page.url().split("/bookings/")[1].split("?")[0];
    refs[email] = (await db.booking.findUniqueOrThrow({ where: { id } })).reference;
  }

  const doctor = await (await browser.newContext()).newPage();
  await login(doctor, "dr.gharbi@demo.lifedeux.com", DEMO_PASSWORD);
  const card = doctor.getByTestId("request-card").filter({ hasText: refs["nadia@demo.lifedeux.com"] });
  await card.locator('input[name="reason"]').fill("Créneau indisponible");

  // The confirmation names the patient and the reference; dismissing it changes nothing.
  let message = "";
  doctor.once("dialog", (d) => { message = d.message(); void d.dismiss(); });
  await card.getByRole("button", { name: "Refuser" }).click();
  expect(message).toContain("Nadia Ben Ali");
  expect(message).toContain(refs["nadia@demo.lifedeux.com"]);
  expect((await db.booking.findUniqueOrThrow({ where: { reference: refs["nadia@demo.lifedeux.com"] } })).status).toBe("REQUESTED");

  doctor.once("dialog", (d) => void d.accept());
  await card.getByRole("button", { name: "Refuser" }).click();
  await expect(doctor).toHaveURL(/done=refused/);

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
