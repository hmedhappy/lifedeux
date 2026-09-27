import { markPaymentSucceeded } from "@/lib/bookings";
import { konnectPaymentCompleted } from "@/lib/payments/konnect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Konnect calls this URL with ?payment_ref=... once a payment ends. The call
 * is not signed, so the status is always re-checked against the Konnect API.
 */
async function handle(request: Request) {
  if (!process.env.KONNECT_API_KEY) return new Response("Konnect not configured", { status: 404 });
  const ref = new URL(request.url).searchParams.get("payment_ref");
  if (!ref) return new Response("Missing payment_ref", { status: 400 });
  if (await konnectPaymentCompleted(ref)) {
    await markPaymentSucceeded({ providerRef: ref });
  }
  return Response.json({ received: true });
}

export const GET = handle;
export const POST = handle;
