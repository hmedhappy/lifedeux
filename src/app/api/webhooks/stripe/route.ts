import Stripe from "stripe";
import { db } from "@/lib/db";
import { markPaymentFailed, markPaymentSucceeded } from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Signature verification needs no network call; the key is only used for API requests.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_signature_verification_only");

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Stripe webhook secret not configured", { status: 500 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.payment_status !== "paid") break;
      const payment = await db.payment.findUnique({ where: { providerRef: session.id } });
      if (!payment) break;
      if (session.amount_total !== payment.amount || session.currency?.toUpperCase() !== payment.currency.toUpperCase()) {
        console.error(`[stripe] amount mismatch for payment ${payment.id}`);
        break;
      }
      await markPaymentSucceeded({ providerRef: session.id });
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      await markPaymentFailed({ providerRef: event.data.object.id });
      break;
  }
  return Response.json({ received: true });
}
