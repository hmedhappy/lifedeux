import Stripe from "stripe";
import type { PaymentProvider } from "./types";

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key);
  return client;
}

const stripeLocales = new Set(["fr", "en", "ar"]);

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  supportsHold: true,
  async createCheckout(req) {
    const session = await stripeClient().checkout.sessions.create(
      {
        mode: "payment",
        customer_email: req.customer.email,
        client_reference_id: req.bookingId,
        locale: (stripeLocales.has(req.locale) ? req.locale : "auto") as Stripe.Checkout.SessionCreateParams.Locale,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: req.currency.toLowerCase(),
              unit_amount: req.amount,
              product_data: { name: req.description },
            },
          },
        ],
        metadata: { paymentId: req.paymentId, bookingId: req.bookingId, reference: req.reference },
        payment_intent_data: {
          metadata: { paymentId: req.paymentId, bookingId: req.bookingId },
          statement_descriptor_suffix: "LIFEDEUX",
          ...(req.hold ? { capture_method: "manual" as const } : {}),
        },
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      },
      { idempotencyKey: `checkout-${req.paymentId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { providerRef: session.id, checkoutUrl: session.url };
  },
};
