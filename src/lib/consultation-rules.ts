/** A consultation slot must start at least this long after the request. */
export const CONSULT_MIN_LEAD_HOURS = 2;

/** Payment must be received at least this long before the consultation. */
export const CONSULT_PAYMENT_CUTOFF_MINUTES = 30;

/** The chat opens a little before the slot so both sides can settle in. */
export const CHAT_OPENS_MINUTES_BEFORE = 10;

/** Without an explicit end, the chat closes this long after the slot start. */
export const CHAT_AUTO_CLOSE_HOURS = 24;

export type ChatState = "not_paid" | "waiting" | "open" | "closed";

export function chatState(
  c: { status: string; endedAt: Date | null; slot: { startsAt: Date } },
  now = new Date(),
): ChatState {
  if (c.status === "COMPLETED" || c.endedAt) return "closed";
  if (c.status !== "PAID") return "not_paid";
  const opens = c.slot.startsAt.getTime() - CHAT_OPENS_MINUTES_BEFORE * 60_000;
  const closes = c.slot.startsAt.getTime() + CHAT_AUTO_CLOSE_HOURS * 3_600_000;
  if (now.getTime() < opens) return "waiting";
  if (now.getTime() > closes) return "closed";
  return "open";
}

/** Slots starting before this instant have (or had) their chat open. */
export function chatOpensBefore(now = new Date()): Date {
  return new Date(now.getTime() + CHAT_OPENS_MINUTES_BEFORE * 60_000);
}
