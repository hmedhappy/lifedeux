"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, getCurrentUser } from "@/lib/auth";
import { toLocale } from "@/lib/i18n";
import { isLatinName } from "@/lib/latin";
import { sendTemplate } from "@/lib/mail";
import { passwordOfferPath } from "@/lib/password-offer";
import { rateLimit } from "@/lib/rate-limit";
import { confirmBookingByEmail, createInPersonBooking, sendBookingConfirmation } from "@/lib/in-person";

/** Who the visitor says they are: checked later by the link in their email. */
export type VisitorInput = { firstName: string; lastName: string; email: string; phone: string };
export type QrResult = { ok: true; email?: string; saved?: boolean } | { ok: false; error: string };

const name = z.string().trim().min(1).max(80).refine(isLatinName, { message: "latin" });
const visitorSchema = z.object({
  firstName: name,
  lastName: name,
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().min(6).max(30),
});

async function allowed(prefix: string): Promise<boolean> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return rateLimit(`${prefix}:${ip}`, 10, 60 * 60 * 1000);
}

/**
 * The visitor's patient account: created on the spot (no password, they add one whenever
 * they like), or the existing one for this email, left unchanged apart from a missing phone.
 */
async function visitorAccount(input: VisitorInput, locale: string) {
  const parsed = visitorSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.some((i) => i.message === "latin") ? "errors.nameNotLatin" : "errors.missingFields" };
  }
  const d = parsed.data;
  const existing = await db.user.findUnique({ where: { email: d.email } });
  if (existing) {
    if (existing.role !== "PATIENT" || !existing.active) return { error: "errors.notPatientAccount" };
    if (!existing.phone) await db.user.update({ where: { id: existing.id }, data: { phone: d.phone } });
    return { user: existing, created: false };
  }
  const user = await db.user.create({
    data: { email: d.email, firstName: d.firstName, lastName: d.lastName, phone: d.phone, role: "PATIENT", locale, consentAt: new Date() },
  });
  return { user, created: true };
}

/** Booking from the practice QR code without signing in: confirmed from the email link. */
export async function bookInPersonAsVisitorAction(localeRaw: string, doctorId: string, slotId: string, input: VisitorInput): Promise<QrResult> {
  const locale = toLocale(localeRaw);
  if (!(await allowed("qr-book"))) return { ok: false, error: "errors.tooManyAttempts" };
  if (!slotId) return { ok: false, error: "errors.chooseSlot" };
  const account = await visitorAccount(input, locale);
  if (!account.user) return { ok: false, error: account.error ?? "errors.invalid" };
  const booked = await createInPersonBooking({ patientId: account.user.id, doctorId, slotId, unverified: true });
  if (!booked.consultation) return { ok: false, error: booked.error ?? "errors.invalid" };
  await sendBookingConfirmation(booked.consultation.id);
  return { ok: true, email: account.user.email };
}

/**
 * "Enregistrer en favori". A signed-in patient toggles it; a visitor gets an account with
 * the doctor already saved, and an email to confirm it and set a password.
 */
export async function saveFavoriteAction(localeRaw: string, doctorId: string, input?: VisitorInput): Promise<QrResult> {
  const locale = toLocale(localeRaw);
  const doctor = await db.doctor.findFirst({ where: { id: doctorId, active: true }, include: { user: true } });
  if (!doctor) return { ok: false, error: "errors.invalid" };
  const me = await getCurrentUser();
  if (me) {
    if (me.role !== "PATIENT") return { ok: false, error: "doctor.patientsOnly" };
    const key = { patientId_doctorId: { patientId: me.id, doctorId } };
    if (await db.favoriteDoctor.findUnique({ where: key })) {
      await db.favoriteDoctor.delete({ where: key });
      return { ok: true, saved: false };
    }
    await db.favoriteDoctor.create({ data: { patientId: me.id, doctorId } });
    return { ok: true, saved: true };
  }
  if (!input) return { ok: false, error: "errors.loginRequired" };
  if (!(await allowed("qr-fav"))) return { ok: false, error: "errors.tooManyAttempts" };
  const account = await visitorAccount(input, locale);
  if (!account.user) return { ok: false, error: account.error ?? "errors.invalid" };
  await db.favoriteDoctor.upsert({
    where: { patientId_doctorId: { patientId: account.user.id, doctorId } },
    create: { patientId: account.user.id, doctorId },
    update: {},
  });
  await sendTemplate(
    account.user,
    "favoriteSaved",
    { doctor: `Dr ${doctor.user.firstName} ${doctor.user.lastName}` },
    `/doctors/${doctorId}`,
    await passwordOfferPath(account.user.id),
  );
  return { ok: true, email: account.user.email, saved: true };
}

/**
 * The button on the page opened from the email (a button, not the link itself: mail
 * scanners open links, they do not press buttons). Signs the patient in: the email is theirs.
 */
export async function confirmBookingAction(localeRaw: string, token: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const outcome = await confirmBookingByEmail(token);
  if (!outcome.ok) redirect(`/${locale}/confirm/${token}?error=${outcome.error}`);
  const user = await db.user.findUniqueOrThrow({ where: { id: outcome.patientId } });
  await createSession(user);
  redirect(`/${locale}/account/consultations/${outcome.consultationId}?requested=1`);
}
