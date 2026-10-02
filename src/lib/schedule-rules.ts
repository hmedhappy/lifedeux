import { fromTunisLocal } from "./format";

/** Weekly availability keyed by JS weekday ("0" = Sunday), each a list of [from, to] in Tunis time. */
export type WeeklySchedule = Record<string, [string, string][]>;

/** Slots are published this far ahead (docs/RELOOKING.md §7). */
export const HORIZON_WEEKS = 4;
export const MAX_BUFFER_MINUTES = 15;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Keeps only well-formed, non-overlapping ranges, sorted. */
export function parseSchedule(value: unknown): WeeklySchedule {
  const out: WeeklySchedule = {};
  if (!value || typeof value !== "object") return out;
  for (let d = 0; d < 7; d++) {
    const raw = (value as Record<string, unknown>)[String(d)];
    if (!Array.isArray(raw)) continue;
    const ranges = raw
      .filter((r): r is [string, string] => Array.isArray(r) && TIME.test(String(r[0])) && TIME.test(String(r[1])) && toMinutes(r[0]) < toMinutes(r[1]))
      .sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
    const merged: [string, string][] = [];
    for (const r of ranges) {
      const last = merged.at(-1);
      if (last && toMinutes(r[0]) < toMinutes(last[1])) continue;
      merged.push([r[0], r[1]]);
    }
    if (merged.length) out[String(d)] = merged;
  }
  return out;
}

export function addDayKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(key: string): number {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

/** True if the Tunis day `key` falls in one of the exceptions (inclusive). */
export function isException(key: string, exceptions: { startsOn: string; endsOn: string }[]): boolean {
  return exceptions.some((e) => e.startsOn <= key && key <= e.endsOn);
}

/**
 * Start times produced by a weekly schedule over `days` days from `fromKey`: each range
 * is cut into consultations of `minutes`, separated by `buffer` minutes.
 */
export function scheduleStarts(
  schedule: WeeklySchedule,
  fromKey: string,
  days: number,
  minutes: number,
  buffer: number,
  exceptions: { startsOn: string; endsOn: string }[] = [],
): Date[] {
  const out: Date[] = [];
  const step = minutes + Math.min(Math.max(buffer, 0), MAX_BUFFER_MINUTES);
  for (let i = 0; i < days; i++) {
    const key = addDayKey(fromKey, i);
    if (isException(key, exceptions)) continue;
    for (const [from, to] of schedule[String(weekdayOf(key))] ?? []) {
      for (let m = toMinutes(from); m + minutes <= toMinutes(to); m += step) out.push(fromTunisLocal(key, toTime(m)));
    }
  }
  return out;
}
