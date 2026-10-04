import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { E2E_ENV } from "../../playwright.config";
import { confirmSheet, db } from "./helpers";

const stamp = Date.now();
const patientEmail = `patient.cabinet.${stamp}@test.dev`;
// Names must be in Latin letters (no digits): encode the run id as letters.
const letters = (n: number) => [...String(n % 100000)].map((d) => "abcdefghij"[Number(d)]).join("");

/** The code is emailed; the test stores a known one (hashed like the app does) as the latest. */
async function knownCode(email: string, code = "424242") {
  const codeHash = createHash("sha256").update(`${email}:${code}:${E2E_ENV.AUTH_SECRET}`).digest("hex");
  await db.loginCode.create({ data: { email, codeHash, expiresAt: new Date(Date.now() + 600_000) } });
  return code;
}

test("a visitor scans the practice QR code and books in a few taps", async ({ browser }) => {
  // A doctor seeing patients at the practice only, auto-confirming, with a free slot this afternoon.
  const specialty = await db.specialty.findFirstOrThrow({ where: { active: true } });
  const doctor = await db.doctor.create({
    data: {
      specialty: specialty.nameFr,
      specialty_: { connect: { id: specialty.id } },
      bio: "",
      languages: [],
      clinicName: "Cabinet Test",
      clinicAddress: "12 avenue Habib Bourguiba",
      city: "Tunis",
      offersConsultation: false,
      offersInPerson: true,
      inPersonPrice: 5000,
      instantBooking: true,
      user: { create: { email: `dr.cabinet.${stamp}@test.dev`, firstName: "Lina", lastName: `Cabinet ${letters(stamp)}`, role: "DOCTOR" as const } },
    },
  });
  const startsAt = new Date(Math.ceil((Date.now() + 3 * 3_600_000) / 1_800_000) * 1_800_000);
  const slot = await db.slot.create({ data: { doctorId: doctor.id, startsAt, kind: "CONSULTATION" } });

  // Phone at the practice: the QR link opens the "at the practice" tab with the slots on the page.
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto(`/fr/doctors/${doctor.id}?service=cabinet`);
  const box = page.getByTestId("cabinet-inline");
  await expect(box).toContainText("50");
  await expect(page.getByTestId("booking-open")).toHaveCount(0);
  await box.getByTestId("slot-times").getByRole("button").first().click();
  await box.getByTestId("booking-submit").click();

  // Last step: only what is needed to create the account.
  const panel = page.getByTestId("auth-panel");
  await panel.getByTestId("auth-email").fill(patientEmail);
  await panel.getByTestId("auth-send-code").click();
  await expect(panel.getByTestId("auth-code")).toBeVisible();
  await panel.getByTestId("auth-code").fill(await knownCode(patientEmail));
  await panel.getByTestId("auth-verify").click();
  await panel.getByTestId("auth-first-name").fill("Ines");
  await panel.getByTestId("auth-last-name").fill("Patiente");
  await panel.getByTestId("auth-consent").check();
  await panel.getByTestId("auth-create").click();

  await expect(page).toHaveURL(/\/fr\/account\/consultations\/.+\?requested=1$/);
  await expect(page.getByTestId("in-person-visit")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "C'est réservé" })).toBeVisible();

  const booked = await db.consultation.findFirstOrThrow({ where: { slotId: slot.id }, include: { slot: true } });
  expect(booked).toMatchObject({ mode: "IN_PERSON", status: "CONFIRMED", price: 5000, doctorFee: 0 });
  expect(booked.slot.status).toBe("BOOKED");

  // A change of plan: one tap (and a confirmation) frees the slot again.
  await page.getByTestId("consult-cancel").click();
  await confirmSheet(page);
  await expect(page.getByRole("status").filter({ hasText: "Rendez-vous annulé" })).toBeVisible();
  expect((await db.slot.findUniqueOrThrow({ where: { id: slot.id } })).status).toBe("FREE");
});
