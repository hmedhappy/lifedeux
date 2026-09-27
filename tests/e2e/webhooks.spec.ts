import { expect, test } from "@playwright/test";
import Stripe from "stripe";
import { E2E_ENV } from "../../playwright.config";
import { db } from "./helpers";

const stripe = new Stripe("sk_test_dummy");

async function confirmedBookingWithStripePayment(amount: number) {
  const patient = await db.user.findUniqueOrThrow({ where: { email: "patient@demo.lifedeux.com" } });
  const offer = await db.doctorOperation.findFirstOrThrow();
  const slot = await db.slot.findFirstOrThrow({ where: { doctorId: offer.doctorId, status: "FREE", startsAt: { gt: new Date(Date.now() + 5 * 86_400_000) } } });
  await db.slot.update({ where: { id: slot.id }, data: { status: "HELD" } });
  const ref = `LD-W${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const booking = await db.booking.create({
    data: {
      reference: ref,
      patientId: patient.id,
      doctorId: offer.doctorId,
      operationId: offer.operationId,
      slotId: slot.id,
      status: "CONFIRMED",
      optionsChosen: true,
      recoveryNights: 7,
      operationPrice: amount,
      totalAmount: amount,
      doctorFee: offer.doctorFee,
      currency: "EUR",
      paymentDeadline: new Date(Date.now() + 86_400_000),
    },
  });
  const sessionId = `cs_test_${Math.random().toString(36).slice(2)}`;
  await db.payment.create({ data: { bookingId: booking.id, provider: "stripe", providerRef: sessionId, amount, currency: "EUR" } });
  return { booking, sessionId, slotId: slot.id };
}

function event(sessionId: string, amount: number) {
  return JSON.stringify({
    id: `evt_${sessionId}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: sessionId, object: "checkout.session", payment_status: "paid", amount_total: amount, currency: "eur" } },
  });
}

test("a correctly signed Stripe webhook marks the booking as paid (idempotent)", async ({ request }) => {
  const { booking, sessionId, slotId } = await confirmedBookingWithStripePayment(550000);
  const payload = event(sessionId, 550000);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: E2E_ENV.STRIPE_WEBHOOK_SECRET });

  for (let i = 0; i < 2; i++) {
    const res = await request.post("/api/webhooks/stripe", { data: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
    expect(res.status()).toBe(200);
  }
  const paid = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { payments: true } });
  expect(paid.status).toBe("PAID");
  expect(paid.qrToken).toBeTruthy();
  expect(paid.payments[0].status).toBe("SUCCEEDED");
  expect((await db.slot.findUniqueOrThrow({ where: { id: slotId } })).status).toBe("BOOKED");
});

test("forged or mismatched Stripe webhooks are ignored", async ({ request }) => {
  const { booking, sessionId } = await confirmedBookingWithStripePayment(550000);

  const forged = await request.post("/api/webhooks/stripe", {
    data: event(sessionId, 550000),
    headers: { "stripe-signature": "t=1,v1=deadbeef", "content-type": "application/json" },
  });
  expect(forged.status()).toBe(400);

  const wrongAmount = event(sessionId, 100);
  const header = stripe.webhooks.generateTestHeaderString({ payload: wrongAmount, secret: E2E_ENV.STRIPE_WEBHOOK_SECRET });
  const res = await request.post("/api/webhooks/stripe", { data: wrongAmount, headers: { "stripe-signature": header, "content-type": "application/json" } });
  expect(res.status()).toBe(200);
  expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");
});

test("the expiry job releases unpaid slots and is protected", async ({ request }) => {
  const { booking, slotId } = await confirmedBookingWithStripePayment(550000);
  await db.booking.update({ where: { id: booking.id }, data: { paymentDeadline: new Date(Date.now() - 1000) } });

  expect((await request.get("/api/cron/expire")).status()).toBe(401);
  const res = await request.get("/api/cron/expire", { headers: { authorization: `Bearer ${E2E_ENV.CRON_SECRET}` } });
  expect(res.status()).toBe(200);
  expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("EXPIRED");
  expect((await db.slot.findUniqueOrThrow({ where: { id: slotId } })).status).toBe("FREE");
});
