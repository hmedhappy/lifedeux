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
  const overdueConsultations = await db.consultation.findMany({
    where: { status: "CONFIRMED", paymentDeadline: { lt: now } },
    include: { patient: true },
  });
  for (const c of overdueConsultations) {
    const updated = await db.$transaction(async (tx) => {
      const res = await tx.consultation.updateMany({ where: { id: c.id, status: "CONFIRMED" }, data: { status: "EXPIRED" } });
      if (res.count === 0) return false;
      await tx.slot.updateMany({ where: { id: c.slotId, status: "HELD" }, data: { status: "FREE" } });
      return true;
    });
    if (updated) await sendTemplate(c.patient, "expired", { reference: c.reference });
  }
  return overdue.length + overdueConsultations.length;
}

export type PaymentOutcome = "paid" | "already" | "unpayable" | "not_found";

/**
 * Marks a payment as succeeded and its booking or consultation as paid.
 * Idempotent: webhooks may be delivered several times. Only ever called from a
 * verified source (signed Stripe webhook, Konnect API check, or the dev mock).
 */
export async function markPaymentSucceeded(where: { id: string } | { providerRef: string }): Promise<PaymentOutcome> {
  const payment = await db.payment.findUnique({ where });
  if (!payment) return "not_found";
  if (payment.consultationId) return markConsultationPaid(payment.id, payment.consultationId, payment.amount);
  if (!payment.bookingId) return "not_found";
  const bookingId = payment.bookingId;

  const outcome = await db.$transaction(async (tx): Promise<PaymentOutcome> => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } });
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
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
      where: { id: bookingId },
      include: { patient: true, slot: true },
    });
    await sendTemplate(
      booking.patient,
      "paid",
      { reference: booking.reference, date: formatDateTime(booking.slot.startsAt, toLocale(booking.patient.locale)) },
      `/account/bookings/${booking.id}/ticket`,
    );
  } else if (outcome === "unpayable") {
    console.warn(`[payments] payment ${payment.id} succeeded but booking ${bookingId} cannot be paid — refund needed`);
  }
  return outcome;
}

async function markConsultationPaid(paymentId: string, consultationId: string, amount: number): Promise<PaymentOutcome> {
  const outcome = await db.$transaction(async (tx): Promise<PaymentOutcome> => {
    await tx.payment.update({ where: { id: paymentId }, data: { status: "SUCCEEDED" } });
    const c = await tx.consultation.findUniqueOrThrow({ where: { id: consultationId } });
    if (c.status === "PAID" || c.status === "COMPLETED") return "already";
    if (c.status !== "CONFIRMED" && c.status !== "EXPIRED") return "unpayable";
    if (amount !== c.price) return "unpayable";
    const slot = await tx.slot.updateMany({
      where: { id: c.slotId, status: c.status === "EXPIRED" ? "FREE" : "HELD" },
      data: { status: "BOOKED" },
    });
    if (slot.count === 0) return "unpayable";
    await tx.consultation.update({ where: { id: c.id }, data: { status: "PAID", paidAt: new Date() } });
    await tx.payment.updateMany({
      where: { consultationId: c.id, id: { not: paymentId }, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return "paid";
  });

  if (outcome === "paid") {
    const c = await db.consultation.findUniqueOrThrow({ where: { id: consultationId }, include: { patient: true, slot: true } });
    await sendTemplate(
      c.patient,
      "consultPaid",
      { reference: c.reference, date: formatDateTime(c.slot.startsAt, toLocale(c.patient.locale)) },
      `/account/consultations/${c.id}`,
    );
  } else if (outcome === "unpayable") {
    console.warn(`[payments] payment ${paymentId} succeeded but consultation ${consultationId} cannot be paid — refund needed`);
  }
  return outcome;
}

export async function markPaymentFailed(where: { id: string } | { providerRef: string }): Promise<void> {
  await db.payment.updateMany({ where: { ...where, status: "PENDING" }, data: { status: "FAILED" } });
}

/** Amount LifeDeux owes each doctor: fees of operations and completed consultations, minus cash already paid. */
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
  const consultations = await db.consultation.groupBy({
    by: ["doctorId"],
    where: { status: "COMPLETED" },
    _sum: { doctorFee: true },
    _count: true,
  });
  type Balance = { earned: number; paid: number; operations: number; consultations: number };
  const result = new Map<string, Balance>();
  const entryFor = (id: string): Balance => {
    const e = result.get(id) ?? { earned: 0, paid: 0, operations: 0, consultations: 0 };
    result.set(id, e);
    return e;
  };
  for (const row of earned) {
    const e = entryFor(row.doctorId);
    e.earned += row._sum.doctorFee ?? 0;
    e.operations = row._count;
  }
  for (const row of consultations) {
    const e = entryFor(row.doctorId);
    e.earned += row._sum.doctorFee ?? 0;
    e.consultations = row._count;
  }
  for (const row of paid) {
    const entry = entryFor(row.doctorId);
    entry.paid = row._sum.amount ?? 0;
  }
  return result;
}
