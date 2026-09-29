"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useI18n } from "./i18n-provider";

export type SlotOption = { id: string; dayKey: string; dayLabel: string; weekday: string; time: string; full: string };

const intlLocale = { fr: "fr-FR", en: "en-GB", ar: "ar-TN" } as const;

/** "YYYY-MM" → the previous or next month, as "YYYY-MM". */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Day keys of a month laid out Monday-first, with null for the leading blanks. */
function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  return cells;
}

export function SlotPicker({ slots }: { slots: SlotOption[] }) {
  const { t, locale } = useI18n();
  const byDay = useMemo(() => {
    const map = new Map<string, SlotOption[]>();
    for (const s of slots) map.set(s.dayKey, [...(map.get(s.dayKey) ?? []), s]);
    return map;
  }, [slots]);

  const firstDay = slots[0]?.dayKey;
  const lastDay = slots[slots.length - 1]?.dayKey;
  const [month, setMonth] = useState(firstDay?.slice(0, 7) ?? "");
  const [day, setDay] = useState(firstDay);
  const [slotId, setSlotId] = useState<string | null>(null);
  const selected = slots.find((s) => s.id === slotId);

  if (slots.length === 0) {
    return <p className="rounded-xl bg-surface p-4 text-sm text-muted">{t("doctor.noSlots")}</p>;
  }

  const fmt = (opts: Intl.DateTimeFormatOptions, key: string) =>
    new Intl.DateTimeFormat(intlLocale[locale], { timeZone: "UTC", ...opts }).format(new Date(`${key}T12:00:00Z`));
  // 2024-01-01 is a Monday: used to print weekday initials in the viewer's language.
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt({ weekday: "narrow" }, `2024-01-0${i + 1}`));
  const canPrev = month > firstDay!.slice(0, 7);
  const canNext = month < lastDay!.slice(0, 7);
  const times = day ? byDay.get(day) ?? [] : [];

  return (
    <div>
      <input type="hidden" name="slotId" value={slotId ?? ""} />
      <div className="rounded-2xl border border-line p-3" data-testid="slot-calendar">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            disabled={!canPrev}
            aria-label={t("doctor.prevMonth")}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface disabled:opacity-30 rtl:rotate-180"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <p className="text-sm font-semibold capitalize text-ink" aria-live="polite">
            {fmt({ month: "long", year: "numeric" }, `${month}-15`)}
          </p>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={!canNext}
            aria-label={t("doctor.nextMonth")}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface disabled:opacity-30 rtl:rotate-180"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-muted">
          {weekdays.map((w, i) => (
            <span key={i} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {monthGrid(month).map((key, i) => {
            if (!key) return <span key={`blank-${i}`} />;
            const available = byDay.has(key);
            const active = key === day;
            return (
              <button
                key={key}
                type="button"
                disabled={!available}
                aria-pressed={active}
                aria-label={fmt({ weekday: "long", day: "numeric", month: "long" }, key)}
                onClick={() => {
                  setDay(key);
                  setSlotId(null);
                }}
                className={clsx(
                  "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition",
                  active
                    ? "bg-ink font-semibold text-white"
                    : available
                      ? "font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4 hover:bg-surface"
                      : "text-muted/40 line-through decoration-transparent",
                )}
              >
                {Number(key.slice(8))}
              </button>
            );
          })}
        </div>
      </div>

      {day && (
        <p className="mt-4 text-sm font-medium capitalize text-ink">{fmt({ weekday: "long", day: "numeric", month: "long" }, day)}</p>
      )}
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="slot-times">
        {times.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSlotId(s.id)}
            aria-pressed={s.id === slotId}
            className={clsx(
              "rounded-lg border px-3 py-2 text-sm font-medium transition",
              s.id === slotId ? "border-brand bg-rose-50 text-brand-dark" : "border-line hover:border-ink",
            )}
          >
            {s.time}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {selected ? t("doctor.selected", { date: selected.full }) : t("doctor.pickTime")}
      </p>
    </div>
  );
}
