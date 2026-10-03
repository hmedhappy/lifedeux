"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Scissors, Video } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { Sheet } from "./overlay";

export type AgendaItem = {
  id: string;
  kind: "consultation" | "operation";
  dayKey: string;
  time: string;
  title: string;
  patient: string;
  fee: string;
  status: string;
  statusLabel: string;
  /** Requested or accepted but not paid yet: drawn with a dashed border. */
  pending: boolean;
  done: boolean;
  href: string;
};

export type FreeSlot = { dayKey: string; time: string; kind: "consultation" | "operation" };

const intlLocale = { fr: "fr-FR", en: "en-GB", ar: "ar-TN-u-nu-latn" } as const;
const MAX_DOTS = 3;

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Monday-first grid of the month; null cells pad the first week. */
function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

/**
 * The doctor's agenda: a month calendar with one dot per booked appointment (primary
 * colour for operations, secondary for consultations). Tapping a day slides up the day's
 * appointments; each time badge opens the consultation or the operation.
 */
export function AgendaCalendar({
  items,
  free,
  today,
  minMonth,
  maxMonth,
}: {
  items: AgendaItem[];
  free: FreeSlot[];
  today: string;
  minMonth: string;
  maxMonth: string;
}) {
  const { t, locale } = useI18n();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const i of items) map.set(i.dayKey, [...(map.get(i.dayKey) ?? []), i]);
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [items]);
  const freeByDay = useMemo(() => {
    const map = new Map<string, FreeSlot[]>();
    for (const f of free) map.set(f.dayKey, [...(map.get(f.dayKey) ?? []), f]);
    return map;
  }, [free]);

  const fmt = (opts: Intl.DateTimeFormatOptions, key: string) =>
    new Intl.DateTimeFormat(intlLocale[locale], { timeZone: "UTC", ...opts }).format(new Date(`${key}T12:00:00Z`));
  const monthItems = items.filter((i) => i.dayKey.startsWith(month));
  const counts = {
    consultation: monthItems.filter((i) => i.kind === "consultation").length,
    operation: monthItems.filter((i) => i.kind === "operation").length,
  };
  const dayItems = day ? (byDay.get(day) ?? []) : [];
  const dayFree = day ? (freeByDay.get(day) ?? []) : [];

  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-card sm:p-6" data-testid="agenda-calendar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            disabled={month <= minMonth}
            aria-label={t("slots.prevMonth")}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
          </button>
          <h2 className="min-w-40 text-center text-lg font-semibold capitalize text-ink" aria-live="polite" data-testid="agenda-month">
            {fmt({ month: "long", year: "numeric" }, `${month}-01`)}
          </h2>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= maxMonth}
            aria-label={t("slots.nextMonth")}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface disabled:opacity-30"
            data-testid="agenda-next"
          >
            <ChevronRight className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {month !== today.slice(0, 7) && (
            <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="min-h-9 rounded-full border border-line px-3 font-semibold text-ink hover:border-brand">
              {t("agenda.today")}
            </button>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
            {t("agenda.legendOperation", { n: counts.operation })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            {t("agenda.legendConsultation", { n: counts.consultation })}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center" role="grid" aria-label={t("agenda.title")}>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="py-1 text-xs font-medium uppercase text-muted" role="columnheader">
            {fmt({ weekday: "short" }, `2024-01-0${i + 1}`)}
          </span>
        ))}
        {monthGrid(month).map((key, i) => {
          if (!key) return <span key={`b${i}`} aria-hidden />;
          const list = byDay.get(key) ?? [];
          const freeCount = freeByDay.get(key)?.length ?? 0;
          const active = list.length > 0 || freeCount > 0;
          const isToday = key === today;
          const past = key < today;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              disabled={!active}
              onClick={() => setDay(key)}
              aria-label={`${fmt({ weekday: "long", day: "numeric", month: "long" }, key)} — ${t("agenda.dayCount", { n: list.length })}`}
              className={clsx(
                "flex aspect-square min-h-11 flex-col items-center justify-center gap-1 rounded-2xl text-sm tabular-nums transition sm:aspect-auto sm:h-20",
                active ? "hover:bg-brand-soft" : "cursor-default",
                isToday && "ring-2 ring-brand",
                list.length > 0 ? "font-semibold text-ink" : freeCount > 0 ? "text-ink-soft" : "text-line-strong",
                past && "opacity-60",
              )}
              data-testid={list.length ? "agenda-day-busy" : undefined}
              data-day={key}
            >
              <span>{Number(key.slice(8))}</span>
              <span className="flex h-2 items-center gap-0.5" aria-hidden>
                {list.slice(0, MAX_DOTS).map((item) => (
                  <span key={item.id} className={clsx("h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2", item.kind === "operation" ? "bg-brand" : "bg-accent")} />
                ))}
                {list.length > MAX_DOTS && <span className="text-[9px] font-bold leading-none text-muted">+{list.length - MAX_DOTS}</span>}
                {list.length === 0 && freeCount > 0 && <span className="h-0.5 w-3 rounded-full bg-line-strong" />}
              </span>
            </button>
          );
        })}
      </div>

      <Sheet open={!!day} onClose={() => setDay(null)} title={day ? fmt({ weekday: "long", day: "numeric", month: "long" }, day) : ""} size="md" testId="agenda-day">
        {dayItems.length === 0 ? (
          <p className="rounded-2xl bg-surface p-4 text-sm text-muted">{t("agenda.noAppointments")}</p>
        ) : (
          <ul className="space-y-2">
            {dayItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 transition hover:border-brand hover:shadow-card"
                  data-testid="agenda-appointment"
                >
                  <span
                    className={clsx(
                      "flex min-w-[4.25rem] flex-col items-center rounded-xl border-2 px-2 py-1.5 text-sm font-bold tabular-nums",
                      item.kind === "operation" ? "border-brand text-brand-dark" : "border-accent text-accent-ink",
                      item.pending ? "border-dashed bg-white" : item.kind === "operation" ? "bg-brand-soft" : "bg-accent-soft",
                      item.done && "opacity-60",
                    )}
                  >
                    {item.time}
                    {item.kind === "operation" ? <Scissors className="mt-0.5 h-3.5 w-3.5" aria-hidden /> : <Video className="mt-0.5 h-3.5 w-3.5" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{item.patient}</span>
                    <span className="block truncate text-sm text-muted">{item.title}</span>
                    <span className="mt-0.5 inline-block text-xs font-medium text-ink-soft">{item.statusLabel}</span>
                  </span>
                  <span className="shrink-0 text-end text-sm font-semibold text-ink">
                    {item.fee}
                    <span className="block text-[11px] font-normal text-muted">{t("agenda.fee")}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted rtl:-scale-x-100" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {dayFree.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("agenda.freeSlots", { n: dayFree.length })}</p>
            <div className="flex flex-wrap gap-1.5">
              {dayFree.map((f, i) => (
                <span key={i} className="rounded-lg border border-dashed border-line-strong px-2 py-1 text-xs tabular-nums text-ink-soft">
                  {f.time}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border-2 border-brand bg-brand-soft" aria-hidden />
            {t("agenda.legendConfirmed")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border-2 border-dashed border-brand" aria-hidden />
            {t("agenda.legendPending")}
          </span>
        </div>
      </Sheet>
    </section>
  );
}
