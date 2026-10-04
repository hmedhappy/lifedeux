import Link from "next/link";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, CalendarPlus, FileText, Scissors } from "lucide-react";
import { StatusBadge } from "@/components/status";
import { SpecialtyIcon } from "@/components/specialty-icon";
import { Badge, Container, Disclosure, EmptyState, LinkButton, LiveDot, PageTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { expireOverdueBookings } from "@/lib/bookings";
import { chatState } from "@/lib/consultation-rules";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale, type TFunction } from "@/lib/i18n";
import { specialtyTint } from "@/lib/specialty-tint";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("account.title") };
}

type Item = {
  key: string;
  href: string;
  at: Date;
  upcoming: boolean;
  testId: "consultation-card" | "booking-card";
  node: React.ReactNode;
};

/** What the patient should do next for a consultation, as one short label. */
function consultNext(c: { status: string; mode: string; slot: { startsAt: Date }; endedAt: Date | null }, t: TFunction, rxCount: number) {
  const chat = chatState(c);
  // At the practice there is nothing to pay online: once confirmed, the patient just comes.
  if (c.mode === "IN_PERSON" && c.status === "CONFIRMED") return { label: t("account.next.upcoming"), tone: "wait" as const };
  if (c.status === "PAID" && chat === "open") return { label: t("account.next.joinChat"), tone: "live" as const };
  if (c.status === "CONFIRMED") return { label: t("account.next.pay"), tone: "action" as const };
  if (c.status === "REQUESTED") return { label: t("account.next.waitingDoctor"), tone: "wait" as const };
  if (c.status === "PAID") return { label: t("account.next.upcoming"), tone: "wait" as const };
  if (rxCount > 0) return { label: t("account.next.prescription", { n: rxCount }), tone: "doc" as const };
  return null;
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const user = await requireRole(locale, ["PATIENT"], `/${locale}/account`);
  // Accounts created with Google may still need a Latin-letter name.
  if (!user.firstName || !user.lastName) redirect(`/${locale}/account/profile?complete=1`);
  await expireOverdueBookings();
  const [bookings, consultations] = await Promise.all([
    db.booking.findMany({
      where: { patientId: user.id },
      include: { doctor: { include: { user: true } }, operation: true, slot: true },
      orderBy: { createdAt: "desc" },
    }),
    db.consultation.findMany({
      where: { patientId: user.id },
      include: {
        doctor: { include: { user: true, specialty_: true } },
        slot: true,
        _count: { select: { prescriptions: { where: { status: "ISSUED" } } } },
      },
      orderBy: { slot: { startsAt: "desc" } },
    }),
  ]);

  const items: Item[] = [
    ...consultations.map((c): Item => {
      const next = consultNext(c, t, c._count.prescriptions);
      const specialty = c.doctor.specialty_ ? localized(c.doctor.specialty_, "name", locale) : c.doctor.specialty;
      return {
        key: c.id,
        href: `/${locale}/account/consultations/${c.id}`,
        at: c.slot.startsAt,
        upcoming: ["REQUESTED", "CONFIRMED", "PAID"].includes(c.status),
        testId: "consultation-card",
        node: (
          <>
            <span className={clsx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", specialtyTint(c.doctor.specialty_?.slug))}>
              <SpecialtyIcon name={c.doctor.specialty_?.icon ?? "Stethoscope"} className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">
                  {t(c.mode === "IN_PERSON" ? "cabinet.tag" : "consult.short")} · {specialty}
                </p>
                {chatState(c) === "open" ? (
                  <Badge tone="green">
                    <LiveDot />
                    {t("chat.live")}
                  </Badge>
                ) : (
                  <StatusBadge status={c.status} t={t} mode={c.mode} />
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted">
                Dr {c.doctor.user.firstName} {c.doctor.user.lastName} · {formatDateTime(c.slot.startsAt, locale)}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted">
                  {c.reference} · {formatMoney(c.price, c.currency, locale)}
                </span>
                {next && (
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1 font-semibold",
                      next.tone === "live" && "text-emerald-700",
                      next.tone === "action" && "text-brand-dark",
                      next.tone === "doc" && "text-brand-dark",
                      next.tone === "wait" && "text-muted",
                    )}
                    data-testid={next.tone === "doc" ? "prescription-badge" : undefined}
                  >
                    {next.tone === "doc" && <FileText className="h-4 w-4" aria-hidden />}
                    {next.label}
                    {next.tone !== "wait" && <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />}
                  </span>
                )}
              </div>
            </div>
          </>
        ),
      };
    }),
    ...bookings.map(
      (b): Item => ({
        key: b.id,
        href: `/${locale}/account/bookings/${b.id}`,
        at: b.slot.startsAt,
        upcoming: ["REQUESTED", "CONFIRMED", "PAID", "IN_PROGRESS"].includes(b.status),
        testId: "booking-card",
        node: (
          <>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-trip-soft text-trip">
              <Scissors className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">{localized(b.operation, "name", locale)}</p>
                <StatusBadge status={b.status} t={t} />
              </div>
              <p className="mt-0.5 text-sm text-muted">
                Dr {b.doctor.user.firstName} {b.doctor.user.lastName} · {formatDateTime(b.slot.startsAt, locale)}
              </p>
              <p className="mt-2 text-sm text-muted">
                {b.reference} · {formatMoney(b.totalAmount, b.currency, locale)}
              </p>
            </div>
          </>
        ),
      }),
    ),
  ];
  const upcoming = items.filter((i) => i.upcoming).sort((a, b) => a.at.getTime() - b.at.getTime());
  const past = items.filter((i) => !i.upcoming).sort((a, b) => b.at.getTime() - a.at.getTime());

  const list = (rows: Item[]) => (
    <ul className="grid gap-3 md:grid-cols-2">
      {rows.map((i) => (
        <li key={i.key}>
          <Link href={i.href} className="flex h-full gap-4 rounded-2xl border border-line bg-white p-4 shadow-card transition hover:shadow-float" data-testid={i.testId}>
            {i.node}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <Container className="py-6 sm:py-10">
      <PageTitle
        title={t("account.title")}
        subtitle={t("account.hello", { name: user.firstName })}
        action={
          <LinkButton href={`/${locale}/doctors`} variant="soft">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            {t("account.newBooking")}
          </LinkButton>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title={t("account.empty")}
          text={t("account.emptyText")}
          action={<LinkButton href={`/${locale}/doctors`}>{t("account.findDoctor")}</LinkButton>}
        />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink">{t("account.upcoming")}</h2>
            {upcoming.length ? list(upcoming) : <p className="rounded-2xl bg-surface p-4 text-sm text-muted">{t("account.noUpcoming")}</p>}
          </section>
          {past.length > 0 && (
            <Disclosure summary={t("account.past", { n: past.length })} defaultOpen={upcoming.length === 0}>
              {list(past)}
            </Disclosure>
          )}
        </div>
      )}
    </Container>
  );
}
