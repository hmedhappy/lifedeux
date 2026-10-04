/** A consultation slot must start at least this long after the request. */
export const CONSULT_MIN_LEAD_HOURS = 2;

/** At the practice the patient may book for later the same day, e.g. from the waiting room. */
export const IN_PERSON_MIN_LEAD_MINUTES = 30;

/** Payment must be received at least this long before the consultation. */
export const CONSULT_PAYMENT_CUTOFF_MINUTES = 30;

/** A paid consultation can be cancelled (full refund) or moved until this long before it. */
export const CONSULT_FREE_CANCEL_HOURS = 24;

/** True while the patient may still cancel with a refund, or ask for another slot. */
export function canChangeFreely(startsAt: Date, now = new Date()): boolean {
  return startsAt.getTime() - now.getTime() > CONSULT_FREE_CANCEL_HOURS * 3_600_000;
}

/** The chat opens a little before the slot so both sides can settle in. */
export const CHAT_OPENS_MINUTES_BEFORE = 10;

/** Without an explicit end, the chat closes this long after the slot start. */
export const CHAT_AUTO_CLOSE_HOURS = 24;

export type ChatState = "not_paid" | "waiting" | "open" | "closed";

export function chatState(
  c: { status: string; endedAt: Date | null; slot: { startsAt: Date } },
  now = new Date(),
): ChatState {
  if (c.status === "COMPLETED" || c.status === "NO_SHOW" || c.endedAt) return "closed";
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

/** The doctor may mark the patient absent this long after the start if they never came. */
export const NO_SHOW_AFTER_MINUTES = 15;

/** A person counts as "in the conversation" if their screen polled this recently. */
export const PRESENCE_SECONDS = 12;

/** "… is typing" lasts this long after the last key press. */
export const TYPING_SECONDS = 5;

export function chatOpensAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() - CHAT_OPENS_MINUTES_BEFORE * 60_000);
}

/** "Patient absent" is offered once the wait is over and the patient never joined. */
export function canMarkNoShow(
  c: { status: string; patientSeenAt: Date | null; slot: { startsAt: Date } },
  now = new Date(),
): boolean {
  if (c.status !== "PAID") return false;
  if (now.getTime() < c.slot.startsAt.getTime() + NO_SHOW_AFTER_MINUTES * 60_000) return false;
  return !c.patientSeenAt || c.patientSeenAt < chatOpensAt(c.slot.startsAt);
}
