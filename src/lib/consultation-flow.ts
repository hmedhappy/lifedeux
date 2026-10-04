import "server-only";
import { db } from "./db";
import { CHAT_AUTO_CLOSE_HOURS, CONSULT_MIN_LEAD_HOURS, CONSULT_PAYMENT_CUTOFF_MINUTES, canChangeFreely } from "./consultation-rules";
import { formatDateTime } from "./format";
import { getT, toLocale } from "./i18n";
import { sendTemplate } from "./mail";
import { capturePayment, raiseAlert, refundPayment, releaseConsultationPayments, releasePayment } from "./payment-ops";
import { getSettings } from "./settings";

/** Practice address for an email body (HTML): typed by the doctor, so escaped. */
export function clinicAddressHtml(d: { clinicName: string; clinicAddress: string; city: string }): string {
  return [d.clinicName, d.clinicAddress, d.city]
    .filter(Boolean)
    .join(", ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Google Maps link to the practice: the pin when known, the address otherwise. */
export function mapsLink(d: { clinicLat: number | null; clinicLng: number | null; clinicAddress: string; city: string }): string {
  const q = d.clinicLat !== null && d.clinicLng !== null ? `${d.clinicLat},${d.clinicLng}` : `${d.clinicAddress}, ${d.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export type AcceptOutcome = "paid" | "confirmed" | "tooLate" | "invalid";

/**
 * The doctor (or instant booking) accepts a request. A card hold is captured at once and
 * the consultation is paid; without a hold the patient gets a deadline to pay
 * (Konnect, or a hold that the bank already dropped). docs/RELOOKING.md §4.
 */
export async function acceptConsultation(id: string): Promise<AcceptOutcome> {
  const c = await db.consultation.findUnique({ where: { id }, include: { slot: true, patient: true } });
  if (!c || c.status !== "REQUESTED") return "invalid";
  const patientLocale = toLocale(c.patient.locale);
  const date = formatDateTime(c.slot.startsAt, patientLocale);

  if (c.mode === "IN_PERSON") {
    // Nothing to pay online: the slot is the patient's as soon as the doctor says yes.
    const done = await db.$transaction(async (tx) => {
      const res = await tx.consultation.updateMany({ where: { id: c.id, status: "REQUESTED" }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
      if (res.count === 0) return false;
      await tx.slot.updateMany({ where: { id: c.slotId, status: "HELD" }, data: { status: "BOOKED" } });
      return true;
    });
    if (!done) return "invalid";
    const doctor = await db.doctor.findUniqueOrThrow({ where: { id: c.doctorId }, include: { user: true } });
    await sendTemplate(
      c.patient,
      "inPersonConfirmed",
      { reference: c.reference, date, doctor: `Dr ${doctor.user.lastName}`, address: clinicAddressHtml(doctor), maps: mapsLink(doctor) },
      `/account/consultations/${c.id}`,
    );
    return "confirmed";
  }

  const hold = await db.payment.findFirst({
    where: { consultationId: c.id, status: "AUTHORIZED" },
    orderBy: { createdAt: "desc" },
  });
  if (hold && hold.amount === c.price) {
    if (await capturePayment(hold)) {
      const now = new Date();
      const done = await db.$transaction(async (tx) => {
        const res = await tx.consultation.updateMany({
          where: { id: c.id, status: "REQUESTED" },
          data: { status: "PAID", confirmedAt: now, paidAt: now },
        });
        if (res.count === 0) return false;
        await tx.slot.updateMany({ where: { id: c.slotId, status: "HELD" }, data: { status: "BOOKED" } });
        await tx.payment.updateMany({
          where: { consultationId: c.id, id: { not: hold.id }, status: "PENDING" },
          data: { status: "FAILED" },
        });
        return true;
      });
      if (done) {
        await sendTemplate(c.patient, "consultPaid", { reference: c.reference, date }, `/account/consultations/${c.id}`);
        return "paid";
      }
      // The patient cancelled while the card was being charged: give the money back.
      const charged = await db.payment.findUniqueOrThrow({ where: { id: hold.id } });
      if (!(await refundPayment(charged))) {
        await raiseAlert({ kind: "refundFailed", severity: "urgent", consultationId: c.id, message: `Refund needed for ${c.reference}` });
      }
      return "invalid";
    }
    await releasePayment(hold);
  }

  const settings = await getSettings();
  const now = Date.now();
  const cutoff = c.slot.startsAt.getTime() - CONSULT_PAYMENT_CUTOFF_MINUTES * 60_000;
  const deadline = new Date(Math.min(now + settings.paymentDeadlineHours * 3_600_000, cutoff));
  if (deadline.getTime() <= now) return "tooLate";
  const res = await db.consultation.updateMany({
    where: { id: c.id, status: "REQUESTED" },
    data: { status: "CONFIRMED", confirmedAt: new Date(), paymentDeadline: deadline },
  });
  if (res.count === 0) return "invalid";
  await sendTemplate(
    c.patient,
    "consultConfirmed",
    { reference: c.reference, date, deadline: formatDateTime(deadline, patientLocale) },
    `/account/consultations/${c.id}`,
  );
  return "confirmed";
}

export type CancelOutcome = "cancelled" | "refunded" | "refundPending" | "tooLate" | "invalid";

/**
 * The patient cancels. Before payment it is always free; once paid, a full refund is
 * given until 24 h before the consultation, and no cancellation after that.
 */
export async function cancelConsultationByPatient(id: string, patientId: string): Promise<CancelOutcome> {
  const c = await db.consultation.findFirst({
    where: { id, patientId, status: { in: ["REQUESTED", "CONFIRMED", "PAID"] } },
    include: { slot: true },
  });
  if (!c) return "invalid";
  const paid = c.status === "PAID";
  if (paid && !canChangeFreely(c.slot.startsAt)) return "tooLate";

  const done = await db.$transaction(async (tx) => {
    const res = await tx.consultation.updateMany({
      where: { id: c.id, status: c.status },
      data: { status: "CANCELLED", cancelledAt: new Date(), rescheduleSlotId: null, rescheduleRequestedAt: null },
    });
    if (res.count === 0) return false;
    await tx.slot.updateMany({ where: { id: c.slotId, status: { in: ["HELD", "BOOKED"] } }, data: { status: "FREE" } });
    if (c.rescheduleSlotId) await tx.slot.updateMany({ where: { id: c.rescheduleSlotId, status: "HELD" }, data: { status: "FREE" } });
    return true;
  });
  if (!done) return "invalid";
  await releaseConsultationPayments(c.id);
  if (!paid) return "cancelled";

  const charged = await db.payment.findMany({ where: { consultationId: c.id, status: "SUCCEEDED" } });
  let ok = true;
  for (const p of charged) ok = (await refundPayment(p)) && ok;
  const patient = await db.user.findUniqueOrThrow({ where: { id: patientId } });
  if (!ok) {
    await raiseAlert({ kind: "refundFailed", severity: "urgent", consultationId: c.id, message: `Refund needed for ${c.reference}` });
  }
  await sendTemplate(patient, "consultCancelled", { reference: c.reference }, `/account/consultations/${c.id}`);
  return ok ? "refunded" : "refundPending";
}

/** The doctor refuses a request that is not paid yet; any card hold is released. */
export async function refuseConsultation(id: string, doctorId: string, reason: string): Promise<boolean> {
  const c = await db.consultation.findFirst({
    where: { id, doctorId, status: { in: ["REQUESTED", "CONFIRMED"] }, paidAt: null },
    include: { patient: true },
  });
  if (!c) return false;
  const done = await db.$transaction(async (tx) => {
    const res = await tx.consultation.updateMany({
      where: { id: c.id, status: c.status },
      data: { status: "REFUSED", refusalReason: reason },
    });
    if (res.count === 0) return false;
    await tx.slot.updateMany({ where: { id: c.slotId, status: "HELD" }, data: { status: "FREE" } });
    return true;
  });
  if (!done) return false;
  await releaseConsultationPayments(c.id);
  await sendTemplate(c.patient, "refused", { reference: c.reference, reason }, `/account/consultations/${c.id}`);
  return true;
}

export type RescheduleOutcome = "requested" | "tooLate" | "slotTaken" | "pending" | "invalid";

/** The patient asks for another slot (until 24 h before); the doctor approves or not. */
export async function requestReschedule(id: string, patientId: string, slotId: string): Promise<RescheduleOutcome> {
  const c = await db.consultation.findFirst({
    where: { id, patientId, status: { in: ["CONFIRMED", "PAID"] } },
    include: { slot: true, doctor: { include: { user: true } } },
  });
  if (!c) return "invalid";
  if (c.rescheduleSlotId) return "pending";
  if (!canChangeFreely(c.slot.startsAt)) return "tooLate";
  const earliest = new Date(Date.now() + CONSULT_MIN_LEAD_HOURS * 3_600_000);
  const held = await db.$transaction(async (tx) => {
    const slot = await tx.slot.updateMany({
      where: { id: slotId, doctorId: c.doctorId, kind: "CONSULTATION", status: "FREE", startsAt: { gt: earliest } },
      data: { status: "HELD" },
    });
    if (slot.count === 0) return false;
    const res = await tx.consultation.updateMany({
      where: { id: c.id, rescheduleSlotId: null },
      data: { rescheduleSlotId: slotId, rescheduleRequestedAt: new Date() },
    });
    if (res.count === 0) throw new Error("reschedule raced");
    return true;
  });
  if (!held) return "slotTaken";
  const slot = await db.slot.findUniqueOrThrow({ where: { id: slotId } });
  const doctorLocale = toLocale(c.doctor.user.locale);
  await sendTemplate(
    c.doctor.user,
    "rescheduleRequested",
    { reference: c.reference, from: formatDateTime(c.slot.startsAt, doctorLocale), date: formatDateTime(slot.startsAt, doctorLocale) },
    `/doctor/consultations/${c.id}`,
  );
  return "requested";
}

/** Drops a pending reschedule request (patient withdraws, doctor refuses, or it is too late). */
async function clearReschedule(id: string, slotId: string) {
  await db.$transaction([
    db.consultation.updateMany({ where: { id, rescheduleSlotId: slotId }, data: { rescheduleSlotId: null, rescheduleRequestedAt: null } }),
    db.slot.updateMany({ where: { id: slotId, status: "HELD" }, data: { status: "FREE" } }),
  ]);
}

export async function withdrawReschedule(id: string, patientId: string): Promise<void> {
  const c = await db.consultation.findFirst({ where: { id, patientId, rescheduleSlotId: { not: null } } });
  if (c?.rescheduleSlotId) await clearReschedule(c.id, c.rescheduleSlotId);
}

export async function answerReschedule(id: string, doctorId: string, accept: boolean): Promise<boolean> {
  const c = await db.consultation.findFirst({
    where: { id, doctorId, status: { in: ["CONFIRMED", "PAID"] }, rescheduleSlotId: { not: null } },
    include: { patient: true },
  });
  if (!c?.rescheduleSlotId) return false;
  const newSlotId = c.rescheduleSlotId;
  if (accept) {
    await db.$transaction(async (tx) => {
      await tx.slot.updateMany({ where: { id: c.slotId, status: { in: ["HELD", "BOOKED"] } }, data: { status: "FREE" } });
      await tx.slot.updateMany({ where: { id: newSlotId, status: "HELD" }, data: { status: c.status === "PAID" ? "BOOKED" : "HELD" } });
      await tx.consultation.update({
        where: { id: c.id },
        data: {
          slotId: newSlotId,
          rescheduleSlotId: null,
          rescheduleRequestedAt: null,
          reminderDaySentAt: null,
          reminderSoonSentAt: null,
        },
      });
    });
  } else {
    await clearReschedule(c.id, newSlotId);
  }
  const slot = await db.slot.findUniqueOrThrow({ where: { id: accept ? newSlotId : c.slotId } });
  const locale = toLocale(c.patient.locale);
  await sendTemplate(
    c.patient,
    "rescheduleAnswered",
    {
      reference: c.reference,
      outcome: getT(locale)(accept ? "email.rescheduleAnswered.accepted" : "email.rescheduleAnswered.refused"),
      date: formatDateTime(slot.startsAt, locale),
    },
    `/account/consultations/${c.id}`,
  );
  return true;
}

/** Requests nobody answered before the slot, and reschedule requests left too late. */
export async function expireStaleConsultations(now = new Date()): Promise<number> {
  const stale = await db.consultation.findMany({
    where: { status: "REQUESTED", slot: { startsAt: { lt: now } } },
    include: { patient: true },
  });
  let count = 0;
  for (const c of stale) {
    const done = await db.$transaction(async (tx) => {
      const res = await tx.consultation.updateMany({ where: { id: c.id, status: "REQUESTED" }, data: { status: "EXPIRED" } });
      if (res.count === 0) return false;
      await tx.slot.updateMany({ where: { id: c.slotId, status: "HELD" }, data: { status: "FREE" } });
      return true;
    });
    if (!done) continue;
    count++;
    await releaseConsultationPayments(c.id);
    await sendTemplate(c.patient, "expired", { reference: c.reference });
  }

  // Fallback close: a paid consultation nobody ended is completed 24 h after its start.
  await db.consultation.updateMany({
    where: { status: "PAID", endedAt: null, slot: { startsAt: { lt: new Date(now.getTime() - CHAT_AUTO_CLOSE_HOURS * 3_600_000) } } },
    data: { status: "COMPLETED", endedAt: now },
  });

  const moves = await db.consultation.findMany({
    where: { rescheduleSlotId: { not: null } },
    select: { id: true, status: true, rescheduleSlotId: true },
  });
  const limit = new Date(now.getTime() + CONSULT_MIN_LEAD_HOURS * 3_600_000);
  const slots = await db.slot.findMany({ where: { id: { in: moves.map((m) => m.rescheduleSlotId!) } } });
  const startOf = new Map(slots.map((s) => [s.id, s.startsAt]));
  for (const m of moves) {
    const starts = startOf.get(m.rescheduleSlotId!);
    if (!["CONFIRMED", "PAID"].includes(m.status) || !starts || starts < limit) await clearReschedule(m.id, m.rescheduleSlotId!);
  }
  return count;
}

/** One review per completed consultation, by its patient. */
export async function submitReview(id: string, patientId: string, rating: number, text: string | null): Promise<boolean> {
  const c = await db.consultation.findFirst({ where: { id, patientId, status: "COMPLETED" }, include: { review: true } });
  if (!c || c.review) return false;
  await db.review.create({ data: { consultationId: c.id, doctorId: c.doctorId, patientId, rating, text } });
  return true;
}
