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
};

export type CheckoutSession = {
  providerRef: string;
  checkoutUrl: string;
};

export interface PaymentProvider {
  id: "stripe" | "konnect" | "mock";
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
}
