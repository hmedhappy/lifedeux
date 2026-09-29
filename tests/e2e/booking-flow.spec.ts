import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_ENV } from "../../playwright.config";
import { demoStamp } from "../../prisma/lib/demo-images";
import { DEMO_PASSWORD, db, futureWeekday, login } from "./helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const doctorEmail = `dr.e2e.${stamp}@test.dev`;
const patientEmail = `patient.e2e.${stamp}@test.dev`;
const slotDay = futureWeekday(12);
const lastName = `Testeur ${stamp % 100000}`;
const doctorName = `Dr Nadia ${lastName}`;

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

let admin: Page;
let doctor: Page;
let patient: Page;
let bookingId: string;

test("public pages render in French, English and Arabic (RTL)", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Consultez un médecin en ligne");
  await expect(page.getByTestId("home-specialty").first()).toBeVisible();
  await expect(page.getByTestId("doctor-card").first()).toBeVisible();

  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("See a doctor online");

  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("استشر طبيبًا");

  await page.goto("/fr/stays");
  expect(await page.getByTestId("stay-card").count()).toBeGreaterThanOrEqual(4);
});

test("protected areas require the right role", async ({ page }) => {
  await page.goto("/fr/admin");
  await expect(page).toHaveURL(/\/fr\/login\?next=/);
  await page.goto("/fr/doctor");
  await expect(page).toHaveURL(/\/fr\/login/);

  await login(page, "patient@demo.lifedeux.com", DEMO_PASSWORD);
  await page.goto("/fr/admin");
  await expect(page).toHaveURL(/\/fr\/account$/);
  await page.goto("/fr/scan");
  await expect(page).toHaveURL(/\/fr\/account$/);
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/fr/login");
  await page.getByLabel(/email/i).fill(E2E_ENV.ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill("not-the-password");
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole("alert").filter({ hasText: /./ })).toContainText("incorrect");
});

test("admin creates a doctor who activates the account from the invitation", async ({ browser }) => {
  admin = await newPage(browser);
  await login(admin, E2E_ENV.ADMIN_EMAIL, E2E_ENV.ADMIN_PASSWORD);
  await expect(admin).toHaveURL(/\/fr\/admin$/);

  await admin.goto("/fr/admin/doctors/new");
  await admin.locator('input[name="firstName"]').fill("Nadia");
  await admin.locator('input[name="lastName"]').fill(lastName);
  await admin.locator('input[name="email"]').fill(doctorEmail);
  await admin.getByTestId("specialty-select").selectOption({ label: "Urologie" });
  await admin.locator('input[name="specialty"]').fill("Urologue");
  await admin.locator('input[name="clinicName"]').fill("Clinique E2E");
  await admin.locator('input[name="city"]').fill("Tunis");
  await admin.locator('input[name="clinicAddress"]').fill("1 rue du Test, Tunis");
  await admin.locator('textarea[name="bio"]').fill("Chirurgienne de test.");
  const op = await db.operation.findUniqueOrThrow({ where: { slug: "prothese-penienne" } });
  await admin.locator(`input[name="op_${op.id}"]`).check();
  await admin.locator(`input[name="price_${op.id}"]`).fill("5000");
  await admin.locator(`input[name="fee_${op.id}"]`).fill("3000");
  await admin.locator('input[name="licenseNumber"]').fill("TN-URO-E2E");
  await admin.getByTestId("stamp-file").setInputFiles({ name: "cachet.png", mimeType: "image/png", buffer: Buffer.from(demoStamp()) });
  await admin.getByRole("button", { name: "Créer et envoyer l'invitation" }).click();

  const notice = admin.getByRole("status").filter({ hasText: "Invitation envoyée" });
  await expect(notice).toBeVisible();
  const link = (await notice.locator("span").innerText()).trim();
  expect(link).toMatch(/\/fr\/invite\/[\w-]+$/);
  const created = await db.doctor.findFirstOrThrow({ where: { user: { email: doctorEmail } }, include: { specialty_: true } });
  expect(created.specialty_?.slug).toBe("urology");
  expect(created.stampImageId).toBeTruthy();
  // The stamp is private: only the admin (and the doctor) can see it.
  expect((await admin.request.get(`/api/images/${created.stampImageId}`)).status()).toBe(404);
  expect((await admin.request.get(`/api/doctors/${created.id}/stamp`)).status()).toBe(200);

  doctor = await newPage(browser);
  await doctor.goto(link);
  await doctor.locator('input[name="password"]').fill("Doctor12345!");
  await doctor.locator('input[name="confirm"]').fill("Doctor12345!");
  await doctor.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(doctor).toHaveURL(/\/fr\/doctor$/);
  await expect(doctor.getByRole("heading", { name: "Demandes de rendez-vous" })).toBeVisible();
});

test("doctor publishes slots", async () => {
  await doctor.goto("/fr/doctor/slots");
  await expect(doctor.locator('input[name="kind"][value="OPERATION"]')).toBeChecked();
  await doctor.locator('input[name="from"]').fill(slotDay);
  await doctor.locator('input[name="times"]').fill("10:00, 15:30");
  await doctor.getByRole("button", { name: "Créer les créneaux" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "2 créneau(x) créé(s)" })).toBeVisible();
});

test("patient registers and requests an appointment", async ({ browser }) => {
  patient = await newPage(browser);
  await patient.goto("/fr/register");
  await patient.locator('input[name="firstName"]').fill("Paul");
  await patient.locator('input[name="lastName"]').fill("Martin");
  await patient.locator('input[name="email"]').fill(patientEmail);
  await patient.locator('input[name="phone"]').fill("+33 6 11 22 33 44");
  await patient.locator('input[name="country"]').fill("France");
  await patient.locator('input[name="password"]').fill("Patient12345!");
  await patient.locator('input[name="consent"]').check();
  await patient.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(patient).toHaveURL(/\/fr\/account$/);

  const doc = await db.doctor.findFirstOrThrow({ where: { user: { email: doctorEmail } } });
  await patient.goto(`/fr/doctors/${doc.id}`);
  await expect(patient.getByRole("heading", { name: doctorName })).toBeVisible();
  // The doctor offers both services; switch to the procedure tab.
  await patient.getByRole("tab", { name: "Intervention" }).click();
  await expect(patient).toHaveURL(/service=operation/);

  // Submitting without a slot is refused.
  await patient.getByRole("button", { name: "Demander ce rendez-vous" }).click();
  await expect(patient.getByRole("alert").filter({ hasText: /./ })).toContainText("Choisissez un créneau");

  await patient.getByTestId("slot-times").getByRole("button", { name: "10:00" }).click();
  await patient.locator('textarea[name="note"]').fill("Arrivée depuis Paris.");
  await patient.getByRole("button", { name: "Demander ce rendez-vous" }).click();
  await expect(patient).toHaveURL(/\/fr\/account\/bookings\/\w+\?requested=1/);
  await expect(patient.getByText("En attente de confirmation").first()).toBeVisible();
  bookingId = patient.url().split("/bookings/")[1].split("?")[0];

  // The requested slot disappears from the public page.
  await patient.goto(`/fr/doctors/${doc.id}?service=operation`);
  await expect(patient.getByTestId("slot-times").getByRole("button", { name: "10:00" })).toHaveCount(0);
});

test("doctor confirms the request with the recovery length", async () => {
  await doctor.goto("/fr/doctor");
  const card = doctor.getByTestId("request-card").filter({ hasText: "Paul Martin" });
  await expect(card).toContainText("Arrivée depuis Paris.");
  await card.locator('input[name="recoveryNights"]').fill("6");
  await card.getByRole("button", { name: "Confirmer pour Paul" }).click();
  await expect(doctor.getByRole("status").filter({ hasText: "confirmé" })).toBeVisible();
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  expect(booking.status).toBe("CONFIRMED");
  expect(booking.recoveryNights).toBe(6);
  expect(booking.paymentDeadline).not.toBeNull();
});

test("patient chooses companions, a house, and pays", async () => {
  await patient.goto(`/fr/account/bookings/${bookingId}`);
  await expect(patient.getByText("Personnalisez votre séjour")).toBeVisible();

  await patient.getByRole("button", { name: "Ajouter un accompagnant" }).click();
  await expect(patient.getByTestId("companions-count")).toHaveText("1");
  await patient.locator('input[name="companion_0_firstName"]').fill("Marie");
  await patient.locator('input[name="companion_0_lastName"]').fill("Martin");
  await patient.locator('input[name="companion_0_passport"]').fill("FR1234567");

  // The single-person studio is too small for two travellers.
  await expect(patient.getByTestId("stay-option").filter({ hasText: "Studio confort" })).toBeDisabled();
  await patient.getByTestId("stay-option").filter({ hasText: "Maison avec jardin" }).click();

  // operation 5000 + transfer 2 x 80 + house 110 x 7 nights = 5930
  await expect(patient.getByTestId("quote-total")).toHaveText(/^5\s930\s€$/);
  // The receipt in the sidebar follows the choices live, before anything is saved.
  await expect(patient.getByTestId("booking-total")).toHaveText(/^5\s930\s€$/);
  await expect(patient.getByTestId("live-travellers")).toHaveText("2");
  await expect(patient.getByTestId("live-stay")).toHaveText(/Maison avec jardin/);
  await patient.getByRole("button", { name: "Continuer vers le paiement" }).last().click();

  await expect(patient.getByRole("heading", { name: "Paiement" })).toBeVisible();
  await expect(patient.getByTestId("booking-total")).toContainText("5");
  await patient.getByRole("button", { name: /^Payer/ }).click();

  await expect(patient).toHaveURL(/\/fr\/payment\/mock\//);
  await patient.getByRole("button", { name: "Simuler un paiement réussi" }).click();
  await expect(patient).toHaveURL(new RegExp(`/fr/account/bookings/${bookingId}\\?payment=success`));
  await expect(patient.getByRole("heading", { name: "Tout est prêt !" })).toBeVisible();

  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { companions: true, slot: true } });
  expect(booking.status).toBe("PAID");
  expect(booking.totalAmount).toBe(593000);
  expect(booking.withTransport).toBe(true);
  expect(booking.companions).toHaveLength(1);
  expect(booking.slot.status).toBe("BOOKED");
  expect(booking.qrToken).toBeTruthy();

  await patient.getByRole("link", { name: "Voir ma fiche de réservation" }).click();
  await expect(patient.getByTestId("ticket")).toContainText(booking.reference);
  await expect(patient.getByTestId("ticket-transfer")).toHaveText("PRISE EN CHARGE AÉROPORT : OUI");
  await expect(patient.getByTestId("ticket")).toContainText("Marie Martin");
  const qr = await patient.getByTestId("ticket-qr").getAttribute("src");
  expect(qr).toMatch(/^data:image\/png;base64,/);
});

test("the same house cannot be booked twice on overlapping dates", async () => {
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const other = await db.user.findUniqueOrThrow({ where: { email: "patient@demo.lifedeux.com" } });
  // A second confirmed booking whose stay overlaps the first one.
  const slot = await db.slot.create({
    data: { doctorId: booking.doctorId, startsAt: new Date(booking.arrivalDate!.getTime() + 3 * 86_400_000), status: "HELD" },
  });
  const second = await db.booking.create({
    data: {
      reference: `LD-E2E${String(stamp).slice(-3)}`,
      patientId: other.id,
      doctorId: booking.doctorId,
      operationId: booking.operationId,
      slotId: slot.id,
      status: "CONFIRMED",
      recoveryNights: 6,
      operationPrice: 500000,
      totalAmount: 500000,
      doctorFee: 300000,
      currency: "EUR",
      paymentDeadline: new Date(Date.now() + 86_400_000),
    },
  });
  const page = patient.context();
  const otherPage = await (await page.browser()!.newContext()).newPage();
  await login(otherPage, "patient@demo.lifedeux.com", DEMO_PASSWORD);
  await otherPage.goto(`/fr/account/bookings/${second.id}`);
  const house = otherPage.getByTestId("stay-option").filter({ hasText: "Maison avec jardin" });
  await expect(house).toBeDisabled();
  await expect(house).toContainText("Indisponible à ces dates");
});

test("field agent scans the QR code and follows the patient; doctor marks the operation", async ({ browser }) => {
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const agent = await newPage(browser);
  await login(agent, "agent@demo.lifedeux.com", DEMO_PASSWORD);
  await expect(agent).toHaveURL(/\/fr\/scan$/);

  // The QR code encodes a locale-free URL; the agent lands in their language.
  await agent.goto(`/scan/${booking.qrToken}`);
  await expect(agent).toHaveURL(new RegExp(`/fr/scan/${booking.qrToken}$`));
  await expect(agent.getByTestId("scan-transfer")).toHaveText("PRISE EN CHARGE AÉROPORT : OUI");

  for (const step of ["Arrivé à l'aéroport", "Installé au logement", "À la clinique"]) {
    await agent.getByRole("button", { name: `Valider : ${step}` }).click();
    await expect(agent.getByRole("button", { name: `Valider : ${step}` })).toHaveCount(0);
  }

  await doctor.goto("/fr/doctor/patients");
  await doctor.getByRole("button", { name: "Marquer comme opéré" }).click();
  await expect(doctor.getByRole("button", { name: "Marquer comme opéré" })).toHaveCount(0);

  await agent.reload();
  for (const step of ["En convalescence au logement", "Reparti vers l'aéroport"]) {
    await agent.getByRole("button", { name: `Valider : ${step}` }).click();
    await expect(agent.getByRole("button", { name: `Valider : ${step}` })).toHaveCount(0);
  }
  await expect(agent.getByText("Séjour terminé.")).toBeVisible();

  const done = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { trackingEvents: true } });
  expect(done.status).toBe("COMPLETED");
  expect(done.trackingEvents).toHaveLength(6);

  await patient.goto(`/fr/account/bookings/${bookingId}`);
  await expect(patient.getByText("Terminé").first()).toBeVisible();
});

test("admin sees the doctor's balance and records a cash payout", async () => {
  await admin.goto("/fr/admin/payouts");
  const row = admin.locator("tr").filter({ hasText: doctorName });
  await expect(row).toContainText(/3\s000/);
  await admin.locator('select[name="doctorId"]').selectOption({ label: doctorName });
  await admin.locator('input[name="amount"]').fill("3000");
  await admin.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Versement enregistré" })).toBeVisible();
  await admin.reload();
  await expect(admin.locator("tr").filter({ hasText: doctorName }).first().locator("td").last()).toHaveText(/^0\s€$/);

  await doctor.goto("/fr/doctor/payouts");
  await expect(doctor.getByText("Déjà versé")).toBeVisible();
  await expect(doctor.locator("table")).toContainText(/3\s000/);
});

test("admin can manage stays and see bookings", async () => {
  await admin.goto("/fr/admin/stays/new");
  await admin.locator('input[name="title"]').fill("Appartement E2E");
  await admin.locator('input[name="city"]').fill("Tunis");
  await admin.locator('input[name="address"]').fill("Centre-ville");
  await admin.locator('input[name="pricePerNight"]').fill("70");
  await admin.locator('input[name="capacity"]').fill("3");
  await admin.locator('textarea[name="description"]').fill("Logement de test.");
  await admin.getByRole("button", { name: "Enregistrer" }).click();
  await expect(admin).toHaveURL(/\/fr\/admin\/stays$/);
  await expect(admin.getByText("Appartement E2E").first()).toBeVisible();

  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  await admin.goto(`/fr/admin/bookings?q=${booking.reference}`);
  await expect(admin.locator("table")).toContainText(booking.reference);
});
