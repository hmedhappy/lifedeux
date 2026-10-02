import "server-only";
import { PAYMENT_CUTOFF_HOURS } from "./constants";
import { db } from "./db";
import { formatDateTime } from "./format";
import { toLocale } from "./i18n";
import { sendTemplate } from "./mail";
import { getSettings } from "./settings";

/** The surgeon accepts a surgery request; the patient then chooses options and pays. */
export async function acceptBooking(id: string, doctorId: string, recoveryNights: number): Promise<"confirmed" | "tooLate" | "invalid"> {
  const booking = await db.booking.findFirst({ where: { id, doctorId, status: "REQUESTED" }, include: { slot: true, patient: true } });
  if (!booking) return "invalid";
  const settings = await getSettings();
  const now = Date.now();
  const cutoff = booking.slot.startsAt.getTime() - PAYMENT_CUTOFF_HOURS * 3_600_000;
  const deadline = new Date(Math.min(now + settings.paymentDeadlineHours * 3_600_000, cutoff));
  if (deadline.getTime() <= now) return "tooLate";
  const updated = await db.booking.updateMany({
    where: { id: booking.id, status: "REQUESTED" },
    data: { status: "CONFIRMED", confirmedAt: new Date(), paymentDeadline: deadline, recoveryNights },
  });
  if (updated.count === 0) return "invalid";
  const locale = toLocale(booking.patient.locale);
  await sendTemplate(
    booking.patient,
    "confirmed",
    { reference: booking.reference, date: formatDateTime(booking.slot.startsAt, locale), deadline: formatDateTime(deadline, locale) },
    `/account/bookings/${booking.id}`,
  );
  return "confirmed";
}

export async function refuseBooking(id: string, doctorId: string, reason: string): Promise<boolean> {
  const booking = await db.booking.findFirst({
    where: { id, doctorId, status: { in: ["REQUESTED", "CONFIRMED"] }, paidAt: null },
    include: { patient: true },
  });
  if (!booking) return false;
  await db.$transaction([
    db.booking.update({ where: { id: booking.id }, data: { status: "REFUSED", refusalReason: reason } }),
    db.slot.updateMany({ where: { id: booking.slotId, status: "HELD" }, data: { status: "FREE" } }),
    db.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { status: "FAILED" } }),
  ]);
  await sendTemplate(booking.patient, "refused", { reference: booking.reference, reason }, `/account/bookings/${booking.id}`);
  return true;
}
