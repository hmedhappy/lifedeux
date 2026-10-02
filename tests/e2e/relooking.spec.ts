import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { E2E_ENV } from "../../playwright.config";
import { DEMO_PASSWORD, confirmSheet, db, login } from "./helpers";

const stamp = Date.now();
const letters = (n: number) => [...String(n % 100000)].map((d) => "abcdefghij"[Number(d)]).join("");

/** The code is only stored hashed: find it back by trying the 1 000 000 possibilities. */
async function readLoginCode(email: string): Promise<string> {
  const row = await db.loginCode.findFirstOrThrow({ where: { email }, orderBy: { createdAt: "desc" } });
  for (let i = 0; i < 1_000_000; i++) {
    const code = String(i).padStart(6, "0");
    if (createHash("sha256").update(`${email}:${code}:${E2E_ENV.AUTH_SECRET}`).digest("hex") === row.codeHash) return code;
  }
  throw new Error("code not found");
}

test("a visitor books a consultation without an account, signing in with an email code", async ({ page }) => {
  const email = `visitor.${stamp}@test.dev`;
  const doc = await db.doctor.findFirstOrThrow({ where: { user: { email: "dr.amira@demo.lifedeux.com" } } });
  await page.goto(`/fr/doctors/${doc.id}`);
  await page.locator("[data-testid=slot-times] button").first().click();
  await page.getByRole("button", { name: "Première consultation" }).or(page.getByRole("button", { name: "Premier avis" })).first().click();
  await page.getByTestId("booking-consent").check();
  await page.getByRole("button", { name: "Demander la consultation" }).click();

  // Sign-in happens at the end, in a sheet.
  const panel = page.getByTestId("auth-panel");
  await panel.getByTestId("auth-email").fill(email);
  await panel.getByTestId("auth-send-code").click();
  await expect(panel.getByTestId("auth-code")).toBeVisible();
  await panel.getByTestId("auth-code").fill(await readLoginCode(email));
  await panel.getByTestId("auth-verify").click();
  // A first visit asks for a name in Latin letters.
  await panel.getByTestId("auth-first-name").fill("سارة");
  await panel.getByTestId("auth-last-name").fill("Visiteur");
  await panel.getByTestId("auth-consent").check();
  await panel.getByTestId("auth-create").click();
  await expect(panel.getByRole("alert").filter({ hasText: /latines/ })).toBeVisible();
  await panel.getByTestId("auth-first-name").fill(`Sara${letters(stamp)}`);
  await panel.getByTestId("auth-create").click();

  await expect(page).toHaveURL(/\/fr\/account\/consultations\/\w+\?requested=1/);
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  expect(user.role).toBe("PATIENT");
  const c = await db.consultation.findFirstOrThrow({ where: { patientId: user.id } });
  expect(c.status).toBe("REQUESTED");
});

test("a paid consultation cancelled more than 24 h before is fully refunded", async ({ page }) => {
  const patient = await db.user.findUniqueOrThrow({ where: { email: "nadia@demo.lifedeux.com" } });
  const doc = await db.doctor.findFirstOrThrow({ where: { user: { email: "dr.amira@demo.lifedeux.com" } } });
  const slot = await db.slot.create({
    data: { doctorId: doc.id, startsAt: new Date(Date.now() + 5 * 86_400_000 + (stamp % 3_600_000)), kind: "CONSULTATION", status: "BOOKED" },
  });
  const c = await db.consultation.create({
    data: {
      reference: `LC-RF${stamp % 100000}`,
      patientId: patient.id,
      doctorId: doc.id,
      slotId: slot.id,
      status: "PAID",
      price: 5000,
      doctorFee: 3500,
      currency: "EUR",
      durationMinutes: 30,
      paidAt: new Date(),
      payments: { create: { provider: "mock", amount: 5000, currency: "EUR", status: "SUCCEEDED" } },
    },
  });
  await login(page, "nadia@demo.lifedeux.com", DEMO_PASSWORD);
  await page.goto(`/fr/account/consultations/${c.id}`);
  await page.getByText("Changer ou annuler").click();
  await page.getByTestId("consult-cancel").click();
  await confirmSheet(page);
  await expect(page).toHaveURL(/cancel=refunded/);
  const after = await db.consultation.findUniqueOrThrow({ where: { id: c.id }, include: { payments: true, slot: true } });
  expect(after.status).toBe("CANCELLED");
  expect(after.payments[0].status).toBe("REFUNDED");
  expect(after.slot.status).toBe("FREE");
});

test("the scheduled job sends the 10-minute reminder once and nudges silent doctors", async ({ request }) => {
  const patient = await db.user.findUniqueOrThrow({ where: { email: "patient@demo.lifedeux.com" } });
  const doc = await db.doctor.findFirstOrThrow({ where: { user: { email: "dr.amira@demo.lifedeux.com" } } });
  const soon = await db.slot.create({ data: { doctorId: doc.id, startsAt: new Date(Date.now() + 8 * 60_000 + (stamp % 60_000)), kind: "CONSULTATION", status: "BOOKED" } });
  const paid = await db.consultation.create({
    data: { reference: `LC-RM${stamp % 100000}`, patientId: patient.id, doctorId: doc.id, slotId: soon.id, status: "PAID", price: 5000, doctorFee: 3500, currency: "EUR", durationMinutes: 30, paidAt: new Date() },
  });
  const later = await db.slot.create({ data: { doctorId: doc.id, startsAt: new Date(Date.now() + 9 * 86_400_000 + (stamp % 60_000)), kind: "CONSULTATION", status: "HELD" } });
  const waiting = await db.consultation.create({
    data: {
      reference: `LC-NG${stamp % 100000}`,
      patientId: patient.id,
      doctorId: doc.id,
      slotId: later.id,
      status: "REQUESTED",
      price: 5000,
      doctorFee: 3500,
      currency: "EUR",
      durationMinutes: 30,
      createdAt: new Date(Date.now() - 50 * 3_600_000),
    },
  });
  const auth = { headers: { Authorization: `Bearer ${E2E_ENV.CRON_SECRET}` } };
  expect((await request.get("/api/cron/expire", auth)).status()).toBe(200);
  expect((await request.get("/api/cron/expire", auth)).status()).toBe(200);

  const [a, b] = await Promise.all([db.consultation.findUniqueOrThrow({ where: { id: paid.id } }), db.consultation.findUniqueOrThrow({ where: { id: waiting.id } })]);
  expect(a.reminderSoonSentAt).not.toBeNull();
  expect(b.doctorNudgedAt).not.toBeNull();
  expect(b.adminAlertedAt).not.toBeNull();
  // Run twice, alerted once.
  expect(await db.alert.count({ where: { consultationId: waiting.id, kind: "noAnswer" } })).toBe(1);
});
