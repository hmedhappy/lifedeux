import "server-only";
import type { TrackingStep } from "@prisma/client";
import { db } from "./db";
import { trackingSequence } from "./tracking";
import { getT, toLocale } from "./i18n";
import { sendTemplate } from "./mail";

/**
 * Moves a paid booking forward to `step` (never backwards). The first step
 * starts the stay (IN_PROGRESS) and the last one closes it (COMPLETED).
 */
export async function advanceTracking(bookingId: string, step: TrackingStep, userId: string): Promise<boolean> {
  const done = await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || (booking.status !== "PAID" && booking.status !== "IN_PROGRESS")) return false;
    const sequence = trackingSequence(!!booking.accommodationId);
    const target = sequence.indexOf(step);
    const current = booking.trackingStep ? sequence.indexOf(booking.trackingStep) : -1;
    if (target === -1 || target <= current) return false;

    const res = await tx.booking.updateMany({
      where: { id: booking.id, trackingStep: booking.trackingStep, status: booking.status },
      data: {
        trackingStep: step,
        status: target === sequence.length - 1 ? "COMPLETED" : "IN_PROGRESS",
      },
    });
    if (res.count === 0) return false;
    await tx.trackingEvent.create({ data: { bookingId: booking.id, step, userId } });
    return true;
  });
  if (done) {
    // Each step of the stay is sent to the patient (docs/RELOOKING.md §10).
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { patient: true } });
    const t = getT(toLocale(booking.patient.locale));
    await sendTemplate(booking.patient, "trackingStep", { reference: booking.reference, step: t(`tracking.${step}`) }, `/account/bookings/${booking.id}`);
  }
  return done;
}
