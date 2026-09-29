import { expect, test, type Browser, type Page } from "@playwright/test";
import { demoPhoto } from "../../prisma/lib/demo-images";
import { DEMO_PASSWORD, db, login } from "./helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const patientEmail = `consult.e2e.${stamp}@test.dev`;
const patientFirst = `Lina${stamp % 10000}`;

async function newPage(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

let patient: Page;
let doctor: Page;
let consultationId: string;
let prescriptionNumber: string;

test("patients browse specialties, filter them and search doctors", async ({ page }) => {
  await page.goto("/fr/doctors");
  expect(await page.getByTestId("specialty-card").count()).toBeGreaterThanOrEqual(40);

  await page.getByTestId("specialty-search").fill("cardio");
  await expect(page.getByTestId("specialty-card")).toHaveCount(1);
  // Search works in every language, whatever the page language.
  await page.getByTestId("specialty-search").fill("Dermatology");
  await expect(page.getByTestId("specialty-card").filter({ hasText: "Dermatologie" })).toHaveCount(1);

  await page.getByTestId("specialty-search").fill("");
  await page.getByTestId("specialty-card").filter({ hasText: "Cardiologie" }).click();
  await expect(page).toHaveURL(/specialty=cardiology/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cardiologie");
  await expect(page.getByTestId("doctor-card").filter({ hasText: "Jaziri" })).toBeVisible();

  await page.goto("/fr/doctors");
  await page.getByTestId("specialty-search").fill("Trabelsi");
  await page.getByRole("button", { name: "Rechercher un médecin" }).click();
  await expect(page).toHaveURL(/q=Trabelsi/);
  await expect(page.getByTestId("doctor-card").filter({ hasText: "Amira Trabelsi" })).toBeVisible();
  await expect(page.getByTestId("doctor-card").filter({ hasText: "Sami Trabelsi" })).toBeVisible();
});

test("patient requests an online consultation", async ({ browser }) => {
  patient = await newPage(browser);
  await patient.goto("/fr/register");
  await patient.locator('input[name="firstName"]').fill(patientFirst);
  await patient.locator('input[name="lastName"]').fill("Consult");
  await patient.locator('input[name="email"]').fill(patientEmail);
  await patient.locator('input[name="phone"]').fill("+33 6 55 44 33 22");
  await patient.locator('input[name="country"]').fill("France");
  await patient.locator('input[name="password"]').fill("Patient12345!");
  await patient.locator('input[name="consent"]').check();
  await patient.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(patient).toHaveURL(/\/fr\/account$/);

  const doc = await db.doctor.findFirstOrThrow({ where: { user: { email: "dr.amira@demo.lifedeux.com" } } });
  await patient.goto(`/fr/doctors/${doc.id}`);
  await expect(patient.getByRole("tab", { name: "Consultation en ligne" })).toHaveCount(0); // single service: no tabs
  await patient.locator("[data-testid=slot-times] button").first().click();
  await patient.locator('textarea[name="reason"]').fill("Eczéma sur les mains.");
  await patient.getByRole("button", { name: "Demander la consultation" }).click();
  await expect(patient).toHaveURL(/\/fr\/account\/consultations\/\w+\?requested=1/);
  await expect(patient.getByText("En attente d'acceptation")).toBeVisible();
  consultationId = patient.url().split("/consultations/")[1].split("?")[0];

  const c = await db.consultation.findUniqueOrThrow({ where: { id: consultationId }, include: { slot: true } });
  expect(c.status).toBe("REQUESTED");
  expect(c.reference).toMatch(/^LC-/);
  expect(c.slot.status).toBe("HELD");
  expect(c.slot.kind).toBe("CONSULTATION");

  await patient.goto("/fr/account");
  await expect(patient.getByTestId("consultation-card").filter({ hasText: c.reference })).toBeVisible();
});

test("doctor accepts, then the patient pays", async ({ browser }) => {
  doctor = await newPage(browser);
  await login(doctor, "dr.amira@demo.lifedeux.com", DEMO_PASSWORD);
  const card = doctor.getByTestId("consult-request-card").filter({ hasText: `${patientFirst} Consult` });
  await expect(card).toContainText("Eczéma sur les mains.");
  await card.getByRole("button", { name: `Accepter la consultation de ${patientFirst}` }).click();
  await expect(doctor).toHaveURL(/done=confirmed/);
  expect((await db.consultation.findUniqueOrThrow({ where: { id: consultationId } })).status).toBe("CONFIRMED");

  await patient.goto(`/fr/account/consultations/${consultationId}`);
  await expect(patient.getByText("Créneau accepté")).toBeVisible();
  await patient.getByRole("button", { name: /^Payer/ }).click();
  await expect(patient).toHaveURL(/\/fr\/payment\/mock\//);
  await patient.getByRole("button", { name: "Simuler un paiement réussi" }).click();
  await expect(patient).toHaveURL(new RegExp(`/fr/account/consultations/${consultationId}\\?payment=success`));
  // Paid but not started yet: the conversation is visible but closed.
  await expect(patient.getByTestId("chat-input")).toBeDisabled();

  const c = await db.consultation.findUniqueOrThrow({ where: { id: consultationId }, include: { slot: true, payments: true } });
  expect(c.status).toBe("PAID");
  expect(c.slot.status).toBe("BOOKED");
  expect(c.payments.some((p) => p.status === "SUCCEEDED")).toBe(true);
});

test("at the scheduled time both sides chat with text and photos", async () => {
  // Fast-forward: the slot starts now.
  const c = await db.consultation.findUniqueOrThrow({ where: { id: consultationId } });
  await db.slot.update({ where: { id: c.slotId }, data: { startsAt: new Date(Date.now() - 60_000) } });

  await patient.goto(`/fr/account/consultations/${consultationId}`);
  await expect(patient.getByTestId("chat-input")).toBeEnabled();
  await expect(patient.getByRole("button", { name: /Appel vidéo/ })).toBeDisabled();
  await patient.getByTestId("chat-input").fill("Bonjour Docteur, voici mon problème.");
  await patient.getByTestId("chat-input").press("Enter");
  await expect(patient.getByTestId("chat-message").filter({ hasText: "voici mon problème" })).toBeVisible();

  await doctor.goto(`/fr/doctor/consultations/${consultationId}`);
  await expect(doctor.getByTestId("chat-message").filter({ hasText: "voici mon problème" })).toBeVisible();
  await doctor.getByTestId("chat-input").fill("Bonjour, envoyez-moi une photo s'il vous plaît.");
  await doctor.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(patient.getByTestId("chat-message").filter({ hasText: "envoyez-moi une photo" })).toBeVisible();

  await patient.getByTestId("chat-file").setInputFiles({ name: "mains.png", mimeType: "image/png", buffer: Buffer.from(demoPhoto()) });
  await expect(patient.getByTestId("chat-image")).toHaveCount(1);
  await expect(doctor.getByTestId("chat-image")).toHaveCount(1);

  // Chat photos are private: not reachable through the public image route, nor by another user.
  const image = await db.image.findFirstOrThrow({ where: { consultationId } });
  expect(image.private).toBe(true);
  expect((await patient.request.get(`/api/images/${image.id}`)).status()).toBe(404);
  const src = await doctor.getByTestId("chat-image").getAttribute("src");
  expect((await doctor.request.get(src!)).status()).toBe(200);
  const stranger = await (await doctor.context().browser()!.newContext()).newPage();
  await login(stranger, "nadia@demo.lifedeux.com", DEMO_PASSWORD);
  expect((await stranger.request.get(src!)).status()).toBe(404);
  expect((await stranger.request.get(`/api/consultations/${consultationId}/messages`)).status()).toBe(404);
});

test("doctor writes, previews and sends a certified prescription", async () => {
  const editor = doctor.getByTestId("rx-editor");
  await editor.getByTestId("rx-search").fill("amox");
  await editor.getByTestId("rx-result").filter({ hasText: "Clamoxyl" }).click();
  const item = editor.getByTestId("rx-item");
  await expect(item).toHaveCount(1);

  // Incomplete lines are refused.
  await editor.getByRole("button", { name: "Aperçu" }).click();
  await expect(editor.getByRole("alert").filter({ hasText: /./ })).toContainText("Complétez chaque ligne");

  await item.locator('input[name="dosage"]').fill("1 gélule");
  await item.locator('input[name="frequency"]').fill("3 fois par jour");
  await item.locator('input[name="duration"]').fill("7 jours");
  await editor.getByRole("button", { name: "Aperçu" }).click();
  const dialog = doctor.getByRole("dialog");
  await expect(dialog.getByTestId("rx-preview")).toBeVisible();

  const draft = await db.prescription.findFirstOrThrow({ where: { consultationId, status: "DRAFT" } });
  const preview = await doctor.request.get(`/api/prescriptions/${draft.id}/pdf`);
  expect(preview.headers()["content-type"]).toBe("application/pdf");
  // The patient cannot open a draft.
  expect((await patient.request.get(`/api/prescriptions/${draft.id}/pdf`)).status()).toBe(404);

  await dialog.getByRole("button", { name: "Signer et envoyer" }).click();
  await expect(doctor.getByText("Ordonnance envoyée au patient.")).toBeVisible();

  const issued = await db.prescription.findUniqueOrThrow({ where: { id: draft.id } });
  expect(issued.status).toBe("ISSUED");
  expect(issued.number).toMatch(/^RX-\d{8}-[0-9A-F]{8}$/);
  expect(issued.contentHash).toMatch(/^[0-9a-f]{64}$/);
  prescriptionNumber = issued.number!;

  const card = patient.getByTestId("chat-prescription");
  await expect(card).toContainText(prescriptionNumber);
  const pdf = await patient.request.get((await card.getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("a pharmacist verifies the prescription from its QR link", async ({ page }) => {
  await page.goto(`/verify/${prescriptionNumber}`);
  await expect(page).toHaveURL(new RegExp(`/fr/verify/${prescriptionNumber}$`));
  await expect(page.getByTestId("verify-ok")).toBeVisible();
  await expect(page.getByTestId("verify-item")).toContainText("Clamoxyl");
  await expect(page.getByText(`${patientFirst} C.`)).toBeVisible();

  // Any change to the content breaks the fingerprint.
  const p = await db.prescription.findUniqueOrThrow({ where: { number: prescriptionNumber }, include: { items: true } });
  await db.prescriptionItem.update({ where: { id: p.items[0].id }, data: { duration: "30 jours" } });
  await page.reload();
  await expect(page.getByTestId("verify-bad")).toBeVisible();
  await db.prescriptionItem.update({ where: { id: p.items[0].id }, data: { duration: "7 jours" } });

  await page.goto("/fr/verify/RX-20200101-DEADBEEF");
  await expect(page.getByTestId("verify-bad")).toBeVisible();
});

test("doctor ends the consultation and the chat becomes read-only", async () => {
  doctor.once("dialog", (d) => void d.accept());
  await doctor.getByRole("button", { name: "Terminer la consultation" }).click();
  await expect(doctor.getByTestId("chat-input")).toBeDisabled();
  expect((await db.consultation.findUniqueOrThrow({ where: { id: consultationId } })).status).toBe("COMPLETED");
  await expect(patient.getByTestId("chat-input")).toBeDisabled();
  const res = await patient.request.post(`/api/consultations/${consultationId}/messages`, { data: { text: "encore là ?" } });
  expect(res.status()).toBe(409);
});

test("a doctor without a stamp cannot prescribe", async ({ page }) => {
  const doc = await db.doctor.findFirstOrThrow({ where: { user: { email: "dr.chaabane@demo.lifedeux.com" } } });
  const patientUser = await db.user.findUniqueOrThrow({ where: { email: patientEmail } });
  const slot = await db.slot.create({ data: { doctorId: doc.id, startsAt: new Date(Date.now() - 120_000 - (stamp % 1000)), kind: "CONSULTATION", status: "BOOKED" } });
  const c = await db.consultation.create({
    data: { reference: `LC-NS${stamp % 100000}`, patientId: patientUser.id, doctorId: doc.id, slotId: slot.id, status: "PAID", price: 5000, doctorFee: 3500, paidAt: new Date(), durationMinutes: 30, currency: "EUR" },
  });
  await login(page, "dr.chaabane@demo.lifedeux.com", DEMO_PASSWORD);
  await page.goto(`/fr/doctor/consultations/${c.id}`);
  await expect(page.getByText("Aucun cachet n'est enregistré")).toBeVisible();
  await expect(page.getByTestId("rx-editor")).toHaveCount(0);
});

test("a super-doctor refers a colleague who joins immediately", async ({ browser }) => {
  const superDoc = await newPage(browser);
  await login(superDoc, "dr.mansour@demo.lifedeux.com", DEMO_PASSWORD);
  await superDoc.getByRole("link", { name: "Parrainage" }).click();
  const link = (await superDoc.getByTestId("referral-link").innerText()).trim();
  expect(link).toMatch(/\/fr\/join\/DR-DEMOSUPER$/);

  const email = `dr.referred.${stamp}@test.dev`;
  const join = await newPage(browser);
  await join.goto(new URL(link).pathname);
  await expect(join.getByText("Dr Hichem Mansour")).toBeVisible();
  await join.locator('input[name="firstName"]').fill("Omar");
  await join.locator('input[name="lastName"]').fill(`Parrainé ${stamp % 10000}`);
  await join.locator('input[name="email"]').fill(email);
  await join.locator('input[name="phone"]').fill("+216 22 333 444");
  await join.locator('select[name="specialtyId"]').selectOption({ label: "Neurologie" });
  await join.locator('input[name="specialty"]').fill("Neurologue");
  await join.locator('input[name="licenseNumber"]').fill("TN-NEU-9999");
  await join.locator('input[name="city"]').fill("Bizerte");
  await join.locator('input[name="clinicName"]').fill("Cabinet Omar");
  await join.locator('input[name="clinicAddress"]').fill("Rue de la Plage, Bizerte");
  await join.locator('input[name="stampFile"]').setInputFiles({ name: "cachet.png", mimeType: "image/png", buffer: Buffer.from(demoPhoto()) });
  await join.locator('input[name="password"]').fill("Doctor12345!");
  await join.locator('input[name="consent"]').check();
  await join.getByRole("button", { name: "Créer mon compte médecin" }).click();
  await expect(join).toHaveURL(/\/fr\/doctor\/slots\?welcome=1/);
  await expect(join.getByText("Bienvenue sur LifeDeux")).toBeVisible();
  // A regular doctor has no referral page.
  await join.goto("/fr/doctor/referrals");
  await expect(join).toHaveURL(/\/fr\/doctor$/);

  const created = await db.user.findUniqueOrThrow({ where: { email }, include: { doctor: { include: { referredBy: { include: { user: true } } } } } });
  expect(created.role).toBe("DOCTOR");
  expect(created.doctor?.referredBy?.user.email).toBe("dr.mansour@demo.lifedeux.com");
  expect(created.doctor?.stampImageId).toBeTruthy();

  await superDoc.reload();
  await expect(superDoc.getByTestId("referral-row").filter({ hasText: `Parrainé ${stamp % 10000}` })).toBeVisible();

  const bad = await newPage(browser);
  await bad.goto("/fr/join/DR-NOPE");
  await expect(bad.getByText("Ce lien de parrainage n'est pas valide.")).toBeVisible();
});

test("admin manages specialties, medications and sees consultations", async ({ page }) => {
  const { E2E_ENV } = await import("../../playwright.config");
  await login(page, E2E_ENV.ADMIN_EMAIL, E2E_ENV.ADMIN_PASSWORD);
  await page.goto("/fr/admin/specialties");
  await expect(page.getByText("Cardiologie")).toBeVisible();

  const name = `Testamol${stamp % 100000}`;
  await page.goto("/fr/admin/medications");
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="dci"]').fill("Paracétamol");
  await page.locator('input[name="strength"]').fill("500 mg");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: `${name} a été ajouté.` })).toBeVisible();
  await page.goto(`/fr/admin/medications?q=${name.toLowerCase()}`);
  await expect(page.getByTestId("medication-row")).toHaveCount(1);

  // The new medication is immediately searchable by doctors.
  const res = await doctor.request.get(`/api/medications?q=${name.slice(0, 6)}`);
  expect(((await res.json()) as { results: { name: string }[] }).results.map((r) => r.name)).toContain(name);

  await page.goto("/fr/admin/consultations");
  await expect(page.getByText("LC-DEMO05")).toBeVisible();
});
