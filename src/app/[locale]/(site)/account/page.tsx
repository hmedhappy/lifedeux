import Link from "next/link";
import { StatusBadge } from "@/components/status";
import { SpecialtyIcon } from "@/components/specialty-icon";
import { Avatar, Badge, Container, EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { expireOverdueBookings } from "@/lib/bookings";
import { chatState } from "@/lib/consultation-rules";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("account.title") };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const user = await requireRole(locale, ["PATIENT"], `/${locale}/account`);
  await expireOverdueBookings();
  const bookings = await db.booking.findMany({
    where: { patientId: user.id },
    include: { doctor: { include: { user: true } }, operation: true, slot: true },
    orderBy: { createdAt: "desc" },
  });
  const consultations = await db.consultation.findMany({
    where: { patientId: user.id },
    include: { doctor: { include: { user: true, specialty_: true } }, slot: true },
    orderBy: { slot: { startsAt: "desc" } },
  });

  return (
    <Container className="py-10">
      <PageTitle
        title={t("account.title")}
        subtitle={t("account.hello", { name: user.firstName })}
        action={<LinkButton href={`/${locale}/doctors`}>{t("account.newBooking")}</LinkButton>}
      />
      {consultations.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-ink">{t("account.consultations")}</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {consultations.map((c) => {
              const live = chatState(c) === "open";
              return (
                <li key={c.id}>
                  <Link
                    href={`/${locale}/account/consultations/${c.id}`}
                    className="flex gap-4 rounded-2xl border border-line p-5 transition hover:shadow-float"
                    data-testid="consultation-card"
                  >
                    <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <SpecialtyIcon name={c.doctor.specialty_?.icon ?? "Stethoscope"} className="h-6 w-6" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-ink">
                          {t("consult.short")} · {c.doctor.specialty_ ? localized(c.doctor.specialty_, "name", locale) : c.doctor.specialty}
                        </p>
                        {live ? <Badge tone="green">{t("chat.live")}</Badge> : <StatusBadge status={c.status} t={t} />}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        Dr {c.doctor.user.firstName} {c.doctor.user.lastName} · {formatDateTime(c.slot.startsAt, locale)}
                      </p>
                      <p className="mt-2 text-sm text-ink">
                        <span className="text-muted">{c.reference}</span> · {formatMoney(c.price, c.currency, locale)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {bookings.length > 0 && consultations.length > 0 && <h2 className="mb-4 text-xl font-semibold text-ink">{t("account.operations")}</h2>}
      {bookings.length === 0 && consultations.length > 0 ? null : bookings.length === 0 ? (
        <EmptyState
          title={t("account.empty")}
          text={t("account.emptyText")}
          action={<LinkButton href={`/${locale}/doctors`}>{t("account.findDoctor")}</LinkButton>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link
                href={`/${locale}/account/bookings/${b.id}`}
                className="flex gap-4 rounded-2xl border border-line p-5 transition hover:shadow-float"
                data-testid="booking-card"
              >
                <Avatar name={`${b.doctor.user.firstName} ${b.doctor.user.lastName}`} src={b.doctor.photoUrl} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{localized(b.operation, "name", locale)}</p>
                    <StatusBadge status={b.status} t={t} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Dr {b.doctor.user.firstName} {b.doctor.user.lastName} · {formatDateTime(b.slot.startsAt, locale)}
                  </p>
                  <p className="mt-2 text-sm text-ink">
                    <span className="text-muted">{b.reference}</span> · {formatMoney(b.totalAmount, b.currency, locale)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
