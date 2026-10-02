import type { SlotOption } from "@/components/slot-strip";
import { formatDate, formatDateTime, formatTime, tunisDayKey } from "./format";
import type { Locale } from "./i18n";

/** Server-side formatting of slots for the client slot strip (Tunisia time). */
export function toSlotOptions(slots: { id: string; startsAt: Date }[], locale: Locale): SlotOption[] {
  return slots.map((s) => ({
    id: s.id,
    dayKey: tunisDayKey(s.startsAt),
    dayLabel: formatDate(s.startsAt, locale, { day: "numeric", month: "short", year: undefined }),
    weekday: formatDate(s.startsAt, locale, { weekday: "short", day: undefined, month: undefined, year: undefined }),
    time: formatTime(s.startsAt, locale),
    full: formatDateTime(s.startsAt, locale),
    iso: s.startsAt.toISOString(),
  }));
}
