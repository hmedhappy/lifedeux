import Link from "next/link";
import { CalendarClock, ChevronRight, Settings2 } from "lucide-react";
import { AgendaCalendar, type AgendaItem, type FreeSlot } from "@/components/agenda-calendar";
import { LinkButton, Notice, PageTitle } from "@/components/ui";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney, formatTime, fromTunisLocal, tunisDayKey } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { nextMonth } from "@/lib/earnings";

const PAST_MONTHS = 2;
const FUTURE_MONTHS = 6;
const PAID = ["PAID", "IN_PROGRESS", "COMPLETED", "NO_SHOW"];
const nowMs = () => Date.now();

function shift(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Agenda: the month calendar of booked appointments comes first; settings live on their own page. */
export default async function DoctorAgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { welcome } = await searchParams;
  const t = getT(locale);
  const { doctor } = await requireDoctor(locale);

  const today = tunisDayKey(new Date());
  const minMonth = shift(today.slice(0, 7), -PAST_MONTHS);
  const maxMonth = shift(today.slice(0, 7), FUTURE_MONTHS);
  const from = fromTunisLocal(`${minMonth}-01`, "00:00");
  const to = fromTunisLocal(`${nextMonth(maxMonth)}-01`, "00:00");
  const inRange = { startsAt: { gte: from, lt: to } };

  const [consultations, bookings, free] = await Promise.all([
    db.consultation.findMany({
      where: { doctorId: doctor.id, status: { in: ["REQUESTED", "CONFIRMED", "PAID", "COMPLETED", "NO_SHOW"] }, slot: inRange },
      include: { patient: true, slot: true },
    }),
    db.booking.findMany({
      where: { doctorId: doctor.id, status: { in: ["REQUESTED", "CONFIRMED", "PAID", "IN_PROGRESS", "COMPLETED"] }, slot: inRange },
      include: { patient: true, slot: true, operation: true },
    }),
    db.slot.findMany({ where: { doctorId: doctor.id, status: "FREE", startsAt: { gt: new Date(), lt: to } }, orderBy: { startsAt: "asc" } }),
  ]);

  // Full names once paid; before that, first name and initial (contacts stay hidden).
  const who = (p: { firstName: string; lastName: string }, paid: boolean) => (paid ? `${p.firstName} ${p.lastName}` : `${p.firstName} ${p.lastName.charAt(0)}.`);
  const items: (AgendaItem & { at: number })[] = [
    ...consultations.map((c) => ({
      id: c.id,
      kind: "consultation" as const,
      dayKey: tunisDayKey(c.slot.startsAt),
      time: formatTime(c.slot.startsAt, locale),
      title: `${t("consult.short")} · ${c.reference}`,
      patient: who(c.patient, PAID.includes(c.status)),
      fee: formatMoney(c.doctorFee, c.currency, locale),
      status: c.status,
      statusLabel: t(`status.${c.status}`),
      pending: c.status === "REQUESTED" || c.status === "CONFIRMED",
      done: c.status === "COMPLETED" || c.status === "NO_SHOW",
      href: `/${locale}/doctor/consultations/${c.id}`,
      at: c.slot.startsAt.getTime(),
    })),
    ...bookings.map((b) => ({
      id: b.id,
      kind: "operation" as const,
      dayKey: tunisDayKey(b.slot.startsAt),
      time: formatTime(b.slot.startsAt, locale),
      title: `${localized(b.operation, "name", locale)} · ${b.reference}`,
      patient: who(b.patient, PAID.includes(b.status)),
      fee: formatMoney(b.doctorFee, b.currency, locale),
      status: b.status,
      statusLabel: t(`status.${b.status}`),
      pending: b.status === "REQUESTED" || b.status === "CONFIRMED",
      done: b.status === "COMPLETED",
      href: `/${locale}/doctor/bookings/${b.id}`,
      at: b.slot.startsAt.getTime(),
    })),
  ];
  const freeSlots: FreeSlot[] = free.map((s) => ({
    dayKey: tunisDayKey(s.startsAt),
    time: formatTime(s.startsAt, locale),
    kind: s.kind === "OPERATION" ? "operation" : "consultation",
  }));
  const now = nowMs();
  const upcoming = items
    .filter((i) => i.at >= now - 3_600_000 && !i.done)
    .sort((a, b) => a.at - b.at)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {welcome && <Notice tone="success">{t("referral.welcome")}</Notice>}
      <PageTitle
        title={t("agenda.title")}
        subtitle={t("agenda.subtitle")}
        action={
          <LinkButton href={`/${locale}/doctor/slots/settings`} variant="secondary" data-testid="agenda-settings">
            <Settings2 className="h-4 w-4" aria-hidden />
            {t("agenda.settings")}
          </LinkButton>
        }
      />

      <AgendaCalendar items={items} free={freeSlots} today={today} minMonth={minMonth} maxMonth={maxMonth} />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">{t("agenda.upcoming")}</h2>
        {upcoming.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-dashed border-line-strong p-5 text-sm text-muted">
            <span className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" aria-hidden />
              {free.length ? t("agenda.noneUpcoming") : t("agenda.noSlotsYet")}
            </span>
            {!free.length && (
              <Link href={`/${locale}/doctor/slots/settings`} className="font-semibold text-brand-dark hover:underline">
                {t("agenda.setUp")}
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-card" data-testid="agenda-upcoming">
            {upcoming.map((i) => (
              <li key={i.id}>
                <Link href={i.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface/60">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${i.kind === "operation" ? "bg-brand" : "bg-accent"}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{i.patient}</span>
                    <span className="block truncate text-sm text-muted">
                      {formatDateTime(new Date(i.at), locale)} · {i.title}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-ink">{i.fee}</span>
                  <ChevronRight className="h-4 w-4 text-muted rtl:-scale-x-100" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
