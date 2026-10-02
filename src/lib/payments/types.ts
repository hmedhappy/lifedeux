export type CheckoutRequest = {
  paymentId: string;
  bookingId: string;
  reference: string;
  amount: number; // in minor units (cents)
  currency: string;
  description: string;
  customer: { email: string; firstName: string; lastName: string; phone?: string | null };
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  locale: string;
  /** Authorise only (card hold); the amount is captured later. */
  hold?: boolean;
};

export type CheckoutSession = {
  providerRef: string;
  checkoutUrl: string;
};

export interface PaymentProvider {
  id: "stripe" | "konnect" | "mock";
  /** Can hold a card and capture later (Stripe, test mode); Konnect cannot. */
  supportsHold: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
}
