"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { Sheet } from "./overlay";

export type SlotOption = { id: string; dayKey: string; dayLabel: string; weekday: string; time: string; full: string; iso: string };

const intlLocale = { fr: "fr-FR", en: "en-GB", ar: "ar-TN-u-nu-latn" } as const;
const TUNIS = "Africa/Tunis";
const noop = () => () => {};

/** The viewer's time zone, read after hydration (the server does not know it). */
function useViewerZone(): string | null {
  return useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  return cells;
}

/**
 * Slot choice in the Doctolib style: a row of days, then time pills for the chosen day.
 * "Plus de dates" opens a month calendar. Times are Tunisia times; when the viewer is in
 * another time zone, their own time is shown next to the choice.
 */
export function SlotStrip({
  slots,
  value,
  onChange,
  name = "slotId",
}: {
  slots: SlotOption[];
  value: string | null;
  onChange: (id: string) => void;
  name?: string;
}) {
  const { t, locale } = useI18n();
  const zone = useViewerZone();
  const byDay = useMemo(() => {
    const map = new Map<string, SlotOption[]>();
    for (const s of slots) map.set(s.dayKey, [...(map.get(s.dayKey) ?? []), s]);
    return map;
  }, [slots]);
  const days = [...byDay.keys()];
  const selected = slots.find((s) => s.id === value) ?? null;
  const [day, setDay] = useState<string | undefined>(selected?.dayKey ?? days[0]);
  const [calendar, setCalendar] = useState(false);
  const [month, setMonth] = useState((selected?.dayKey ?? days[0] ?? "").slice(0, 7));

  if (slots.length === 0) {
    return <p className="rounded-2xl bg-surface p-4 text-sm text-muted">{t("doctor.noSlots")}</p>;
  }

  const fmt = (opts: Intl.DateTimeFormatOptions, key: string) =>
    new Intl.DateTimeFormat(intlLocale[locale], { timeZone: "UTC", ...opts }).format(new Date(`${key}T12:00:00Z`));
  const times = day ? (byDay.get(day) ?? []) : [];
  const visibleDays = days.slice(0, 14);
  const localTime =
    selected && zone && zone !== TUNIS
      ? new Intl.DateTimeFormat(intlLocale[locale], { timeZone: zone, hour: "2-digit", minute: "2-digit", weekday: "short" }).format(new Date(selected.iso))
      : null;

  const pickDay = (key: string) => {
    setDay(key);
    setMonth(key.slice(0, 7));
  };

  return (
    <div>
      <input type="hidden" name={name} value={value ?? ""} />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label={t("doctor.chooseDay")} data-testid="slot-days">
        {visibleDays.map((key) => (
          <button
            key={key}
            type="button"
            role="option"
            aria-selected={key === day}
            onClick={() => pickDay(key)}
            className={clsx(
              "flex min-h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border text-center transition",
              key === day ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:border-brand",
            )}
          >
            <span className={clsx("text-[11px] font-medium uppercase", key === day ? "text-white/80" : "text-muted")}>{fmt({ weekday: "short" }, key)}</span>
            <span className="text-lg font-bold leading-tight">{fmt({ day: "numeric" }, key)}</span>
            <span className={clsx("text-[11px]", key === day ? "text-white/80" : "text-muted")}>{fmt({ month: "short" }, key)}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCalendar(true)}
          className="flex min-h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line-strong text-[11px] font-semibold text-ink-soft hover:border-brand"
        >
          <CalendarDays className="h-5 w-5" aria-hidden />
          {t("doctor.moreDates")}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" data-testid="slot-times">
        {times.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            aria-pressed={s.id === value}
            className={clsx(
              "min-h-11 min-w-[4.5rem] rounded-xl border px-3 text-sm font-semibold tabular-nums transition",
              s.id === value ? "animate-pop border-brand bg-brand-soft text-brand-dark" : "border-line bg-white text-ink hover:border-brand",
            )}
          >
            {s.time}
          </button>
        ))}
      </div>

      {selected && (
        <p className="mt-3 text-sm text-ink-soft" data-testid="slot-summary">
          <span className="font-semibold text-ink">{selected.full}</span> · {t("doctor.tunisTime")}
          {localTime && <span className="block text-muted">{t("doctor.yourTime", { time: localTime })}</span>}
        </p>
      )}

      <Sheet open={calendar} onClose={() => setCalendar(false)} title={t("doctor.moreDates")} size="sm">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            disabled={month <= days[0].slice(0, 7)}
            aria-label={t("slots.prevMonth")}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
          </button>
          <p className="font-semibold capitalize text-ink">{fmt({ month: "long", year: "numeric" }, `${month}-01`)}</p>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= days[days.length - 1].slice(0, 7)}
            aria-label={t("slots.nextMonth")}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="py-1 text-xs font-medium text-muted">
              {fmt({ weekday: "narrow" }, `2024-01-0${i + 1}`)}
            </span>
          ))}
          {monthGrid(month).map((key, i) =>
            key ? (
              <button
                key={key}
                type="button"
                disabled={!byDay.has(key)}
                onClick={() => {
                  pickDay(key);
                  setCalendar(false);
                }}
                className={clsx(
                  "flex h-11 items-center justify-center rounded-full text-sm tabular-nums transition",
                  key === day ? "bg-brand font-bold text-white" : byDay.has(key) ? "font-semibold text-ink hover:bg-brand-soft" : "text-line-strong",
                )}
              >
                {Number(key.slice(8))}
              </button>
            ) : (
              <span key={`b${i}`} />
            ),
          )}
        </div>
      </Sheet>
    </div>
  );
}
