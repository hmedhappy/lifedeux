import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, CalendarClock, Check, CircleDashed, MessageCircle, Wallet } from "lucide-react";
import { RequestInbox, type InboxItem } from "@/components/request-inbox";
import { StatusBadge } from "@/components/status";
import { Badge, LinkButton, LiveDot, Notice } from "@/components/ui";
import { requireDoctor } from "@/lib/auth";
import { expireOverdueBookings } from "@/lib/bookings";
import { chatState } from "@/lib/consultation-rules";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney, fromTunisLocal, tunisDayKey } from "@/lib/format";
import { getT, localized, toLocale, type TFunction } from "@/lib/i18n";

const initial = (first: string, last: string) => `${first} ${last.charAt(0)}.`;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

/** First day of the current month, Tunis time. */
function monthStart(now = new Date()): Date {
  return fromTunisLocal(`${tunisDayKey(now).slice(0, 7)}-01`, "00:00");
}

export default async function DoctorTodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ done?: string; ref?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { done, ref } = await searchParams;
  const t = getT(locale);
  const { user, doctor: me } = await requireDoctor(locale);
  await expireOverdueBookings();
  const since = monthStart();

  const [doctor, consultRequests, bookingRequests, upcoming, moves, monthConsults, monthOps, awaiting, futureSlots] = await Promise.all([
    db.doctor.findUniqueOrThrow({ where: { id: me.id }, include: { specialty_: true } }),
    db.consultation.findMany({
      where: { doctorId: me.id, status: "REQUESTED" },
      include: {
        patient: true,
        slot: true,
        payments: { where: { status: "AUTHORIZED" }, select: { id: true } },
        _count: { select: { messages: { where: { kind: "IMAGE" } } } },
      },
      orderBy: { slot: { startsAt: "asc" } },
    }),
    db.booking.findMany({
      where: { doctorId: me.id, status: "REQUESTED" },
      include: { patient: true, operation: true, slot: true },
      orderBy: { slot: { startsAt: "asc" } },
    }),
    db.consultation.findMany({
      where: { doctorId: me.id, status: "PAID", endedAt: null, slot: { startsAt: { gt: hoursAgo(3) } } },
      include: { patient: true, slot: true },
      orderBy: { slot: { startsAt: "asc" } },
      take: 3,
    }),
    db.consultation.count({ where: { doctorId: me.id, rescheduleSlotId: { not: null }, status: { in: ["CONFIRMED", "PAID"] } } }),
    db.consultation.aggregate({
      where: { doctorId: me.id, status: { in: ["COMPLETED", "NO_SHOW"] }, slot: { startsAt: { gte: since } } },
      _sum: { doctorFee: true },
      _count: true,
    }),
    db.booking.aggregate({
      where: { doctorId: me.id, status: { in: ["IN_PROGRESS", "COMPLETED"] }, slot: { startsAt: { gte: since } } },
      _sum: { doctorFee: true },
      _count: true,
    }),
    db.booking.findMany({
      where: { doctorId: me.id, status: "CONFIRMED" },
      include: { patient: true, operation: true, slot: true },
      orderBy: { slot: { startsAt: "asc" } },
    }),
    db.slot.count({ where: { doctorId: me.id, status: "FREE", startsAt: { gt: new Date() } } }),
  ]);

  const currency = consultRequests[0]?.currency ?? bookingRequests[0]?.currency ?? "EUR";
  const items: InboxItem[] = [
    ...consultRequests.map((c) => ({
      kind: "consultation" as const,
      id: c.id,
      reference: c.reference,
      name: initial(c.patient.firstName, c.patient.lastName),
      country: c.patient.country,
      when: formatDateTime(c.slot.startsAt, locale),
      fee: formatMoney(c.doctorFee, c.currency, locale),
      service: t("consult.short"),
      reason: c.reason,
      photos: c._count.messages,
      held: c.payments.length > 0,
      nights: 0,
      at: c.slot.startsAt.getTime(),
    })),
    ...bookingRequests.map((b) => ({
      kind: "booking" as const,
      id: b.id,
      reference: b.reference,
      name: initial(b.patient.firstName, b.patient.lastName),
      country: b.patient.country,
      when: formatDateTime(b.slot.startsAt, locale),
      fee: formatMoney(b.doctorFee, b.currency, locale),
      service: localized(b.operation, "name", locale),
      reason: b.patientNote,
      photos: 0,
      held: false,
      nights: b.recoveryNights,
      at: b.slot.startsAt.getTime(),
    })),
  ]
    .sort((a, b) => a.at - b.at);

  const steps = [
    { key: "photo", done: !!doctor.photoUrl && doctor.bio.length > 40, href: `/${locale}/doctor/profile` },
    { key: "stamp", done: !!doctor.stampImageId, href: `/${locale}/doctor/prescription#stamp` },
    { key: "schedule", done: !!doctor.weeklySchedule || futureSlots > 0, href: `/${locale}/doctor/slots/settings` },
    { key: "price", done: !!(doctor.consultationPrice ?? doctor.specialty_?.consultationPrice), href: `/${locale}/doctor/profile` },
  ];
  const progress = steps.filter((s) => s.done).length;
  const earned = (monthConsults._sum.doctorFee ?? 0) + (monthOps._sum.doctorFee ?? 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t("today.hello", { name: user.lastName })}</h1>
        <p className="text-muted">{t("today.subtitle", { n: items.length })}</p>
      </header>

      {done && ref && ["confirmed", "refused", "accepted"].includes(done) && <Notice tone="success">{t(`doctorArea.${done}`, { reference: ref })}</Notice>}
      {done === "tooLate" && ref && <Notice tone="warning">{t("doctorArea.tooLate", { reference: ref })}</Notice>}

      {progress < steps.length && (
        <section className="rounded-3xl border border-line bg-white p-5 shadow-card" data-testid="onboarding">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-ink">{t("today.onboardingTitle")}</h2>
            <span className="text-sm font-semibold text-brand-dark">
              {progress}/{steps.length}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(progress / steps.length) * 100}%` }} />
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.key}>
                <Link href={s.href} className={clsx("flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm", s.done ? "text-muted" : "bg-surface font-medium text-ink hover:bg-brand-soft")}>
                  {s.done ? <Check className="h-4 w-4 text-brand" aria-hidden /> : <CircleDashed className="h-4 w-4 text-muted" aria-hidden />}
                  <span className={clsx(s.done && "line-through")}>{t(`today.steps.${s.key}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && <NextConsultations t={t} locale={locale} list={upcoming} />}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">{t("today.inbox")}</h2>
          {items.length > 0 && <Badge tone="amber">{items.length}</Badge>}
        </div>
        <RequestInbox items={items} locale={locale} />
      </section>

      {moves > 0 && (
        <Link href={`/${locale}/doctor/consultations`} className="flex items-center gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-ink" data-testid="today-moves">
          <CalendarClock className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <span className="flex-1">{t("today.moves", { n: moves })}</span>
          <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Link href={`/${locale}/doctor/payouts`} className="rounded-3xl border border-line bg-white p-5 shadow-card transition hover:shadow-float" data-testid="today-earnings">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Wallet className="h-4 w-4" aria-hidden />
            {t("today.monthEarnings")}
          </p>
          <p className="mt-1 text-2xl font-bold text-ink">{formatMoney(earned, currency, locale)}</p>
          <p className="text-sm text-muted">{t("today.monthActs", { n: monthConsults._count + monthOps._count })}</p>
        </Link>
        <section className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 className="text-sm text-muted">{t("doctorArea.awaitingPayment")}</h2>
          {awaiting.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{t("doctorArea.noneAwaiting")}</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {awaiting.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{initial(b.patient.firstName, b.patient.lastName)}</span>
                  <span className="text-muted">{formatDateTime(b.slot.startsAt, locale)}</span>
                  <StatusBadge status={b.status} t={t} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function NextConsultations({
  t,
  locale,
  list,
}: {
  t: TFunction;
  locale: string;
  list: { id: string; status: string; endedAt: Date | null; slot: { startsAt: Date }; patient: { firstName: string; lastName: string }; reason: string | null }[];
}) {
  const [first, ...rest] = list;
  const live = chatState(first) === "open";
  return (
    <section className="rounded-3xl bg-brand p-5 text-white shadow-float" data-testid="today-next">
      <p className="flex items-center gap-2 text-sm text-white/80">
        {live && <LiveDot />}
        {t(live ? "today.liveNow" : "today.next")}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xl font-bold">
            {first.patient.firstName} {first.patient.lastName}
          </p>
          <p className="text-white/85">{formatDateTime(first.slot.startsAt, locale as never)}</p>
          {first.reason && <p className="mt-1 line-clamp-1 text-sm text-white/75">{first.reason}</p>}
        </div>
        <LinkButton href={`/${locale}/doctor/consultations/${first.id}`} variant="secondary" className="border-white bg-white text-brand-dark">
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t(live ? "today.join" : "today.open")}
        </LinkButton>
      </div>
      {rest.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-white/20 pt-3 text-sm text-white/85">
          {rest.map((c) => (
            <li key={c.id}>
              <Link href={`/${locale}/doctor/consultations/${c.id}`} className="hover:underline">
                {formatDateTime(c.slot.startsAt, locale as never)} · {c.patient.firstName} {c.patient.lastName.charAt(0)}.
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
