import { expect, test } from "@playwright/test";
import { confirmSheet, db } from "./helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const patientEmail = `patient.cabinet.${stamp}@test.dev`;
// Names must be in Latin letters (no digits): encode the run id as letters.
const letters = (n: number) => [...String(n % 100000)].map((d) => "abcdefghij"[Number(d)]).join("");

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

  // Phone at the practice: the QR link opens one screen with the doctor and two buttons.
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto(`/fr/doctors/${doctor.id}?service=cabinet`);
  const qr = page.getByTestId("qr-experience");
  await expect(qr).toContainText("50");
  await qr.getByTestId("qr-book").click();

  // Stepper: a time (the next slide comes by itself), then name, email and phone.
  await qr.getByTestId("qr-times").getByRole("button").first().click();
  await qr.getByTestId("qr-first-name").fill("Ines");
  await qr.getByTestId("qr-last-name").fill("Patiente");
  await qr.getByTestId("qr-email").fill(patientEmail);
  await qr.getByTestId("qr-phone").fill("+216 20 000 000");
  await qr.getByTestId("qr-step-identity").getByTestId("qr-submit").click();
  await expect(qr.getByTestId("qr-step-sent")).toContainText(patientEmail);

  // Not sent to the doctor until the patient confirms from their mailbox.
  const waiting = await db.consultation.findFirstOrThrow({ where: { slotId: slot.id } });
  expect(waiting.status).toBe("UNVERIFIED");
  await page.goto(`/fr/confirm/${waiting.emailConfirmToken}`);
  await page.getByTestId("confirm-booking-button").click();

  await expect(page).toHaveURL(/\/fr\/account\/consultations\/.+\?requested=1$/);
  await expect(page.getByTestId("in-person-visit")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "C'est réservé" })).toBeVisible();

  const booked = await db.consultation.findFirstOrThrow({ where: { slotId: slot.id }, include: { slot: true } });
  expect(booked).toMatchObject({ mode: "IN_PERSON", status: "CONFIRMED", price: 5000, doctorFee: 0 });
  expect(booked.slot.status).toBe("BOOKED");

  // The confirmation email offers a password (optional: the email code keeps working).
  const account = await db.user.findUniqueOrThrow({ where: { email: patientEmail } });
  expect(account.passwordHash).toBeNull();
  expect(account.inviteToken).toBeTruthy();
  const setup = await (await browser.newContext()).newPage();
  await setup.goto(`/fr/reset/${account.inviteToken}?new=1`);
  await expect(setup.getByRole("heading", { name: "Créer mon mot de passe" })).toBeVisible();
  await setup.locator('input[name="password"]').fill("Patient12345!");
  await setup.locator('input[name="confirm"]').fill("Patient12345!");
  await setup.getByRole("button", { name: "Enregistrer mon mot de passe" }).click();
  await expect(setup).toHaveURL(/\/fr\/account$/);
  expect((await db.user.findUniqueOrThrow({ where: { email: patientEmail } })).passwordHash).toBeTruthy();

  // A change of plan: one tap (and a confirmation) frees the slot again.
  await page.getByTestId("consult-cancel").click();
  await confirmSheet(page);
  await expect(page.getByRole("status").filter({ hasText: "Rendez-vous annulé" })).toBeVisible();
  expect((await db.slot.findUniqueOrThrow({ where: { id: slot.id } })).status).toBe("FREE");
});

test("a visitor saves the doctor to their favourites from the QR code", async ({ browser }) => {
  const doctor = await db.doctor.findFirstOrThrow({ where: { offersInPerson: true, user: { email: { startsWith: "dr.cabinet." } } } });
  const email = `patient.favori.${Date.now()}@test.dev`;
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto(`/fr/doctors/${doctor.id}?service=cabinet`);
  const qr = page.getByTestId("qr-experience");
  await qr.getByTestId("qr-favorite").click();
  await qr.getByTestId("qr-first-name").fill("Sami");
  await qr.getByTestId("qr-last-name").fill("Favori");
  await qr.getByTestId("qr-email").fill(email);
  await qr.getByTestId("qr-phone").fill("+216 21 000 000");
  await qr.getByTestId("qr-submit").click();
  await expect(qr.getByTestId("qr-step-saved")).toContainText(email);

  const account = await db.user.findUniqueOrThrow({ where: { email }, include: { favorites: true } });
  expect(account.role).toBe("PATIENT");
  expect(account.favorites.map((f) => f.doctorId)).toEqual([doctor.id]);
  // The email carries the link to confirm the account and choose a password.
  expect(account.inviteToken).toBeTruthy();
});
