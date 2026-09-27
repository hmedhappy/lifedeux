import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { sendTemplate } from "./mail";
import { randomToken } from "./tokens";
import { formatDateTime } from "./format";
import { toLocale } from "./i18n";

/** Bookings whose accommodation dates are reserved (paid, or waiting for payment). */
const LODGING_BLOCKING: Prisma.BookingWhereInput = {
  OR: [
    { status: { in: ["PAID", "IN_PROGRESS"] } },
    { status: "CONFIRMED", optionsChosen: true },
  ],
};

export async function isAccommodationAvailable(
  accommodationId: string,
  arrival: Date,
  departure: Date,
  excludeBookingId?: string,
  tx: Prisma.TransactionClient = db,
): Promise<boolean> {
  const clash = await tx.booking.findFirst({
    where: {
      accommodationId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      arrivalDate: { lt: departure },
      departureDate: { gt: arrival },
      ...LODGING_BLOCKING,
    },
    select: { id: true },
  });
  return !clash;
}

/** Releases slots of confirmed bookings that were not paid in time. Safe to call often. */
export async function expireOverdueBookings(now = new Date()): Promise<number> {
  const overdue = await db.booking.findMany({
    where: { status: "CONFIRMED", paymentDeadline: { lt: now } },
    include: { patient: true },
  });
  for (const booking of overdue) {
    const updated = await db.$transaction(async (tx) => {
      const res = await tx.booking.updateMany({
        where: { id: booking.id, status: "CONFIRMED" },
        data: { status: "EXPIRED" },
      });
      if (res.count === 0) return false;
      await tx.slot.updateMany({ where: { id: booking.slotId, status: "HELD" }, data: { status: "FREE" } });
      return true;
    });
    if (updated) {
      await sendTemplate(booking.patient, "expired", { reference: booking.reference });
    }
  }
  return overdue.length;
}

export type PaymentOutcome = "paid" | "already" | "unpayable" | "not_found";

/**
 * Marks a payment as succeeded and the booking as paid. Idempotent: webhooks
 * may be delivered several times. Only ever called from a verified source
 * (signed Stripe webhook, Konnect API check, or the dev mock).
 */
export async function markPaymentSucceeded(where: { id: string } | { providerRef: string }): Promise<PaymentOutcome> {
  const payment = await db.payment.findUnique({ where });
  if (!payment) return "not_found";

  const outcome = await db.$transaction(async (tx): Promise<PaymentOutcome> => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } });
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
    if (["PAID", "IN_PROGRESS", "COMPLETED"].includes(booking.status)) return "already";
    if (booking.status !== "CONFIRMED" && booking.status !== "EXPIRED") return "unpayable";
    if (payment.amount !== booking.totalAmount) return "unpayable";

    // Late payment after expiry: accept only if nobody else took the slot or the lodging meanwhile.
    if (
      booking.status === "EXPIRED" &&
      booking.accommodationId &&
      booking.arrivalDate &&
      booking.departureDate &&
      !(await isAccommodationAvailable(booking.accommodationId, booking.arrivalDate, booking.departureDate, booking.id, tx))
    ) {
      return "unpayable";
    }
    const slot = await tx.slot.updateMany({
      where: { id: booking.slotId, status: booking.status === "EXPIRED" ? "FREE" : "HELD" },
      data: { status: "BOOKED" },
    });
    if (slot.count === 0) return "unpayable";

    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "PAID", paidAt: new Date(), qrToken: randomToken(24) },
    });
    await tx.payment.updateMany({
      where: { bookingId: booking.id, id: { not: payment.id }, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return "paid";
  });

  if (outcome === "paid") {
    const booking = await db.booking.findUniqueOrThrow({
      where: { id: payment.bookingId },
      include: { patient: true, slot: true },
    });
    await sendTemplate(
      booking.patient,
      "paid",
      { reference: booking.reference, date: formatDateTime(booking.slot.startsAt, toLocale(booking.patient.locale)) },
      `/account/bookings/${booking.id}/ticket`,
    );
  } else if (outcome === "unpayable") {
    console.warn(`[payments] payment ${payment.id} succeeded but booking ${payment.bookingId} cannot be paid — refund needed`);
  }
  return outcome;
}

export async function markPaymentFailed(where: { id: string } | { providerRef: string }): Promise<void> {
  await db.payment.updateMany({ where: { ...where, status: "PENDING" }, data: { status: "FAILED" } });
}

/** Amount LifeDeux owes each doctor: fees of operated bookings minus cash already paid. */
export async function doctorBalances() {
  const [earned, paid] = await Promise.all([
    db.booking.groupBy({
      by: ["doctorId"],
      where: {
        OR: [
          { status: "COMPLETED" },
          { status: "IN_PROGRESS", trackingStep: { in: ["OPERATED", "RECOVERING", "DEPARTED"] } },
        ],
      },
      _sum: { doctorFee: true },
      _count: true,
    }),
    db.doctorPayout.groupBy({ by: ["doctorId"], _sum: { amount: true } }),
  ]);
  const result = new Map<string, { earned: number; paid: number; operations: number }>();
  for (const row of earned) {
    result.set(row.doctorId, { earned: row._sum.doctorFee ?? 0, paid: 0, operations: row._count });
  }
  for (const row of paid) {
    const entry = result.get(row.doctorId) ?? { earned: 0, paid: 0, operations: 0 };
    entry.paid = row._sum.amount ?? 0;
    result.set(row.doctorId, entry);
  }
  return result;
}
