import "server-only";
import { db } from "./db";
import { acceptConsultation } from "./consultation-flow";
import { IN_PERSON_MIN_LEAD_MINUTES } from "./consultation-rules";
import { formatDateTime } from "./format";
import { toLocale } from "./i18n";
import { sendTemplate } from "./mail";
import { passwordOfferPath } from "./password-offer";
import { inPersonOffer } from "./queries";
import { getSettings } from "./settings";
import { bookingReference, randomToken } from "./tokens";

/** A visitor has this long to click the link in their email before the slot is freed. */
export const EMAIL_CONFIRM_MINUTES = 30;

/**
 * Holds the slot and creates the appointment at the practice. Without a signed-in patient
 * it waits (UNVERIFIED) for the link sent by email; otherwise it is a request at once.
 */
export async function createInPersonBooking(input: { patientId: string; doctorId: string; slotId: string; reason?: string | null; unverified: boolean }) {
  const doctor = await db.doctor.findFirst({ where: { id: input.doctorId, active: true, user: { active: true } } });
  const offer = doctor ? inPersonOffer(doctor) : null;
  if (!doctor || !offer) return { error: "errors.invalid" as const };
  const settings = await getSettings();
  const earliest = new Date(Date.now() + IN_PERSON_MIN_LEAD_MINUTES * 60_000);
  const consultation = await db.$transaction(async (tx) => {
    const held = await tx.slot.updateMany({
      where: { id: input.slotId, doctorId: doctor.id, kind: "CONSULTATION", status: "FREE", startsAt: { gt: earliest } },
      data: { status: "HELD" },
    });
    if (held.count === 0) return null;
    return tx.consultation.create({
      data: {
        reference: bookingReference().replace("LD-", "LC-"),
        mode: "IN_PERSON",
        status: input.unverified ? "UNVERIFIED" : "REQUESTED",
        emailConfirmToken: input.unverified ? randomToken(24) : null,
        emailConfirmExpiresAt: input.unverified ? new Date(Date.now() + EMAIL_CONFIRM_MINUTES * 60_000) : null,
        patientId: input.patientId,
        doctorId: doctor.id,
        slotId: input.slotId,
        reason: input.reason ?? null,
        durationMinutes: doctor.consultationMinutes,
        price: offer.price,
        // Paid at the practice: Medelys owes the doctor nothing for it.
        doctorFee: 0,
        currency: settings.currency,
      },
      include: { slot: true },
    });
  });
  if (!consultation) return { error: "errors.slotTaken" as const };
  return { consultation };
}

/** The request reaches the doctor: confirmed at once with instant booking, otherwise they confirm. */
export async function submitInPerson(consultationId: string): Promise<void> {
  const c = await db.consultation.findUniqueOrThrow({
    where: { id: consultationId },
    include: { slot: true, patient: true, doctor: { include: { user: true } } },
  });
  const doctorDate = formatDateTime(c.slot.startsAt, toLocale(c.doctor.user.locale));
  await sendTemplate(
    c.doctor.user,
    "newInPerson",
    { reference: c.reference, date: doctorDate, patient: `${c.patient.firstName} ${c.patient.lastName}` },
    `/doctor/consultations/${c.id}`,
  );
  if (c.doctor.instantBooking) {
    await acceptConsultation(c.id);
    return;
  }
  await sendTemplate(
    c.patient,
    "inPersonRequested",
    { reference: c.reference, date: formatDateTime(c.slot.startsAt, toLocale(c.patient.locale)), doctor: `Dr ${c.doctor.user.lastName}` },
    `/account/consultations/${c.id}`,
    await passwordOfferPath(c.patientId),
  );
}

/** Asks a visitor to confirm their booking from their mailbox. */
export async function sendBookingConfirmation(consultationId: string): Promise<void> {
  const c = await db.consultation.findUniqueOrThrow({ where: { id: consultationId }, include: { slot: true, patient: true, doctor: { include: { user: true } } } });
  if (!c.emailConfirmToken) return;
  await sendTemplate(
    c.patient,
    "confirmBooking",
    {
      reference: c.reference,
      date: formatDateTime(c.slot.startsAt, toLocale(c.patient.locale)),
      doctor: `Dr ${c.doctor.user.lastName}`,
      minutes: String(EMAIL_CONFIRM_MINUTES),
    },
    `/confirm/${c.emailConfirmToken}`,
  );
}

export type EmailConfirmOutcome = { ok: true; consultationId: string; patientId: string } | { ok: false; error: "expired" | "taken" };

/** The visitor clicked the link: the email is theirs, the booking goes to the doctor. */
export async function confirmBookingByEmail(token: string): Promise<EmailConfirmOutcome> {
  const c = await db.consultation.findUnique({ where: { emailConfirmToken: token } });
  if (!c) return { ok: false, error: "expired" };
  if (c.status !== "UNVERIFIED") {
    // Clicked twice: the booking is already through.
    return ["REQUESTED", "CONFIRMED", "COMPLETED"].includes(c.status) ? { ok: true, consultationId: c.id, patientId: c.patientId } : { ok: false, error: "expired" };
  }
  if (!c.emailConfirmExpiresAt || c.emailConfirmExpiresAt < new Date()) return { ok: false, error: "expired" };
  const res = await db.consultation.updateMany({ where: { id: c.id, status: "UNVERIFIED" }, data: { status: "REQUESTED", emailConfirmExpiresAt: null } });
  if (res.count === 0) return { ok: false, error: "taken" };
  await submitInPerson(c.id);
  return { ok: true, consultationId: c.id, patientId: c.patientId };
}

/** Bookings never confirmed by email free their slot. */
export async function expireUnverifiedBookings(now = new Date()): Promise<number> {
  const stale = await db.consultation.findMany({ where: { status: "UNVERIFIED", emailConfirmExpiresAt: { lt: now } }, select: { id: true, slotId: true } });
  for (const c of stale) {
    await db.$transaction(async (tx) => {
      const res = await tx.consultation.updateMany({ where: { id: c.id, status: "UNVERIFIED" }, data: { status: "EXPIRED" } });
      if (res.count) await tx.slot.updateMany({ where: { id: c.slotId, status: "HELD" }, data: { status: "FREE" } });
    });
  }
  return stale.length;
}
