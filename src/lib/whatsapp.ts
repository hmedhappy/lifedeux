import "server-only";

/**
 * WhatsApp through the Meta Cloud API. Messages a business starts must use an approved
 * template: create one named WHATSAPP_TEMPLATE (default "lifedeux_notification") with a
 * single body variable {{1}}, in each language you use. Without WHATSAPP_TOKEN and
 * WHATSAPP_PHONE_ID nothing is sent and the caller falls back to email (docs/RELOOKING.md §10).
 */
export function whatsappEnabled(): boolean {
  return !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;
}

/** Digits only, international format without "+" or "00" (e.g. 21698123456). */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

const LANG: Record<string, string> = { fr: "fr", en: "en", ar: "ar" };

export async function sendWhatsApp(phone: string, text: string, locale: string): Promise<boolean> {
  if (!whatsappEnabled()) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE || "lifedeux_notification",
          language: { code: LANG[locale] ?? "fr" },
          // Template variables cannot contain new lines or more than 4 spaces in a row.
          components: [{ type: "body", parameters: [{ type: "text", text: text.replace(/\s+/g, " ").slice(0, 1000) }] }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[whatsapp] send failed", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (error) {
    console.error("[whatsapp] send failed", error);
    return false;
  }
}
