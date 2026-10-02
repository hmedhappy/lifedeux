import type { PaymentProvider } from "./types";

/**
 * Konnect (Tunisia) — https://docs.konnect.network
 * Amounts are sent in the smallest unit of the wallet currency
 * (millimes for TND, cents for EUR/USD).
 */
function apiUrl(): string {
  return (process.env.KONNECT_API_URL ?? "https://api.sandbox.konnect.network/api/v2").replace(/\/$/, "");
}

function headers(): HeadersInit {
  const key = process.env.KONNECT_API_KEY;
  if (!key) throw new Error("KONNECT_API_KEY is not set");
  return { "x-api-key": key, "Content-Type": "application/json" };
}

/** Konnect uses 3 decimals for TND and 2 for other currencies; our amounts are in cents. */
function toKonnectAmount(cents: number, currency: string): number {
  return currency.toUpperCase() === "TND" ? cents * 10 : cents;
}

export const konnectProvider: PaymentProvider = {
  id: "konnect",
  supportsHold: false,
  async createCheckout(req) {
    const res = await fetch(`${apiUrl()}/payments/init-payment`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        receiverWalletId: process.env.KONNECT_WALLET_ID,
        token: req.currency.toUpperCase(),
        amount: toKonnectAmount(req.amount, req.currency),
        type: "immediate",
        description: req.description,
        acceptedPaymentMethods: ["bank_card", "e-DINAR", "wallet"],
        lifespan: 60,
        checkoutForm: false,
        addPaymentFeesToAmount: false,
        firstName: req.customer.firstName,
        lastName: req.customer.lastName,
        phoneNumber: req.customer.phone ?? undefined,
        email: req.customer.email,
        orderId: req.paymentId,
        webhook: req.webhookUrl,
        silentWebhook: true,
        successUrl: req.successUrl,
        failUrl: req.cancelUrl,
        theme: "light",
      }),
    });
    if (!res.ok) throw new Error(`Konnect init-payment failed: ${res.status}`);
    const data = (await res.json()) as { payUrl?: string; paymentRef?: string };
    if (!data.payUrl || !data.paymentRef) throw new Error("Konnect did not return a payment URL");
    return { providerRef: data.paymentRef, checkoutUrl: data.payUrl };
  },
};

/** Asks Konnect for the real status of a payment (webhooks carry no signature). */
export async function konnectPaymentCompleted(paymentRef: string): Promise<boolean> {
  const res = await fetch(`${apiUrl()}/payments/${encodeURIComponent(paymentRef)}`, { headers: headers() });
  if (!res.ok) return false;
  const data = (await res.json()) as { payment?: { status?: string } };
  return data.payment?.status === "completed";
}
