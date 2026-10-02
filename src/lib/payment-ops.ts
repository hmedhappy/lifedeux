import "server-only";
import type { Payment } from "@prisma/client";
import { db } from "./db";
import { stripeClient } from "./payments/stripe";

async function stripeIntent(payment: Payment): Promise<string | null> {
  if (!payment.providerRef) return null;
  const session = await stripeClient().checkout.sessions.retrieve(payment.providerRef);
  return typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
}

/** Charges a card hold. Test (mock) holds always capture. */
export async function capturePayment(payment: Payment): Promise<boolean> {
  if (payment.status !== "AUTHORIZED") return false;
  try {
    if (payment.provider === "stripe") {
      const intent = await stripeIntent(payment);
      if (!intent) return false;
      await stripeClient().paymentIntents.capture(intent, {}, { idempotencyKey: `capture-${payment.id}` });
    }
    await db.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } });
    return true;
  } catch (error) {
    console.error(`[payments] capture failed for ${payment.id}`, error);
    return false;
  }
}

/** Releases a card hold without charging (refusal, cancellation, no answer). */
export async function releasePayment(payment: Payment): Promise<void> {
  if (payment.status !== "AUTHORIZED" && payment.status !== "PENDING") return;
  try {
    if (payment.provider === "stripe" && payment.status === "AUTHORIZED") {
      const intent = await stripeIntent(payment);
      if (intent) await stripeClient().paymentIntents.cancel(intent, {}, { idempotencyKey: `release-${payment.id}` });
    }
  } catch (error) {
    // The bank drops an uncaptured hold by itself after a few days anyway.
    console.error(`[payments] release failed for ${payment.id}`, error);
  }
  await db.payment.update({ where: { id: payment.id }, data: { status: payment.status === "AUTHORIZED" ? "CANCELED" : "FAILED" } });
}

/**
 * Full refund (partial refunds are not offered, docs/RELOOKING.md §4). Stripe refunds
 * through the API; other providers are recorded as refunded outside the platform.
 */
export async function refundPayment(payment: Payment): Promise<boolean> {
  if (payment.status !== "SUCCEEDED") return false;
  if (payment.provider === "stripe" && process.env.STRIPE_SECRET_KEY) {
    try {
      const intent = await stripeIntent(payment);
      if (!intent) return false;
      await stripeClient().refunds.create({ payment_intent: intent }, { idempotencyKey: `refund-${payment.id}` });
    } catch (error) {
      console.error(`[payments] refund failed for ${payment.id}`, error);
      return false;
    }
  }
  await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
  return true;
}

/** Releases every open hold / pending checkout of a consultation. */
export async function releaseConsultationPayments(consultationId: string): Promise<void> {
  const open = await db.payment.findMany({ where: { consultationId, status: { in: ["AUTHORIZED", "PENDING"] } } });
  for (const p of open) await releasePayment(p);
}

export async function raiseAlert(input: { kind: string; message: string; severity?: "normal" | "urgent"; bookingId?: string; consultationId?: string; doctorId?: string }) {
  await db.alert.create({ data: { severity: "normal", ...input } });
}
