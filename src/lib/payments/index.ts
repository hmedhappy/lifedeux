import { konnectProvider } from "./konnect";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

/** Local fake checkout, only for development and automated tests. */
const mockProvider: PaymentProvider = {
  id: "mock",
  supportsHold: true,
  async createCheckout(req) {
    const base = new URL(req.successUrl).origin;
    return {
      providerRef: `mock_${req.paymentId}`,
      checkoutUrl: `${base}/${req.locale}/payment/mock/${req.paymentId}`,
    };
  },
};

export function mockPaymentsEnabled(): boolean {
  return process.env.PAYMENT_MOCK === "true";
}

/** Providers are switched on simply by setting their environment variables. */
export function availableProviders(): PaymentProvider[] {
  const providers: PaymentProvider[] = [];
  if (process.env.STRIPE_SECRET_KEY) providers.push(stripeProvider);
  if (process.env.KONNECT_API_KEY && process.env.KONNECT_WALLET_ID) providers.push(konnectProvider);
  if (mockPaymentsEnabled()) providers.push(mockProvider);
  return providers;
}

export function getProvider(id: string): PaymentProvider | undefined {
  return availableProviders().find((p) => p.id === id);
}

/** Countries paying in Tunisian dinars see Konnect first, everyone else Stripe (cards, Apple Pay, Google Pay). */
export function providersFor(country: string | null | undefined, options: { hold?: boolean } = {}): PaymentProvider[] {
  const list = availableProviders().filter((p) => !options.hold || p.supportsHold);
  const tunisia = !!country && /tunis|tunisie|تونس/i.test(country);
  const rank = (p: PaymentProvider) => (p.id === "mock" ? 2 : (p.id === "konnect") === tunisia ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b));
}

export type { PaymentProvider } from "./types";
