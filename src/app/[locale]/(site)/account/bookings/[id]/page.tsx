import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { OptionsForm, type StayOption } from "@/components/options-form";
import { JourneyStepper, StatusBadge, TrackingTimeline, journeyIndex } from "@/components/status";
import { Avatar, Button, Container, LinkButton, Notice } from "@/components/ui";
import { cancelBookingAction, chooseOptionsAction, editOptionsAction, startPaymentAction } from "@/actions/patient";
import { requireRole } from "@/lib/auth";
import { expireOverdueBookings } from "@/lib/bookings";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { availableProviders } from "@/lib/payments";
import { computeStay } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ payment?: string; requested?: string }>;
}) {
  const { locale: raw, id } = await params;
  const { payment, requested } = await searchParams;
  const locale = toLocale(raw);
  const t = getT(locale);
  const user = await requireRole(locale, ["PATIENT"], `/${locale}/account/bookings/${id}`);
  await expireOverdueBookings();

  const booking = await db.booking.findFirst({
    where: { id, patientId: user.id },
    include: {
      doctor: { include: { user: true } },
      operation: true,
      slot: true,
      accommodation: true,
      companions: true,
      trackingEvents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking) notFound();

  const settings = await getSettings();
  const money = (v: number) => formatMoney(v, booking.currency, locale);
  const doctorName = `Dr ${booking.doctor.user.firstName} ${booking.doctor.user.lastName}`;
  const stay = computeStay({ operationDate: booking.slot.startsAt, recoveryNights: booking.recoveryNights });
  const step = journeyIndex(booking.status, booking.optionsChosen);

  let stayOptions: StayOption[] = [];
  if (booking.status === "CONFIRMED" && !booking.optionsChosen) {
    const [stays, clashes] = await Promise.all([
      db.accommodation.findMany({ where: { active: true }, orderBy: { pricePerNight: "asc" } }),
      db.booking.findMany({
        where: {
          id: { not: booking.id },
          accommodationId: { not: null },
          arrivalDate: { lt: stay.departureDate },
          departureDate: { gt: stay.arrivalDate },
          OR: [{ status: { in: ["PAID", "IN_PROGRESS"] } }, { status: "CONFIRMED", optionsChosen: true }],
        },
        select: { accommodationId: true },
      }),
    ]);
    const taken = new Set(clashes.map((c) => c.accommodationId));
    stayOptions = stays.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      city: s.city,
      capacity: s.capacity,
      bedrooms: s.bedrooms,
      pricePerNight: s.pricePerNight,
      amenities: s.amenities,
      photo: s.photos[0] ?? null,
      available: !taken.has(s.id),
    }));
  }

  const providers = availableProviders();
  const trackingTimes = Object.fromEntries(booking.trackingEvents.map((e) => [e.step, formatDateTime(e.createdAt, locale)]));

  return (
    <Container className="py-10">
      <Link href={`/${locale}/account`} className="text-sm font-medium text-ink underline">
        ← {t("account.title")}
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {localized(booking.operation, "name", locale)}
        </h1>
        <StatusBadge status={booking.status} t={t} />
      </div>
      <p className="mt-1 text-muted">
        {t("booking.reference")} <span className="font-mono font-semibold text-ink">{booking.reference}</span>
      </p>

      {step >= 0 && (
        <div className="mt-8 max-w-3xl">
          <JourneyStepper index={step} t={t} />
        </div>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-8">
          {requested && booking.status === "REQUESTED" && <Notice tone="success">{t("booking.requestSent")}</Notice>}
          {payment === "success" && booking.status === "CONFIRMED" && (
            <>
              <Notice tone="info">{t("booking.paymentProcessing")}</Notice>
              <AutoRefresh />
            </>
          )}
          {payment === "cancelled" && booking.status === "CONFIRMED" && (
            <Notice tone="warning">{t("booking.paymentCancelled")}</Notice>
          )}

          {booking.status === "REQUESTED" && (
            <StatusBlock title={t("booking.requestedTitle")} text={t("booking.requestedText", { doctor: doctorName })} />
          )}
          {booking.status === "REFUSED" && (
            <StatusBlock
              title={t("booking.refusedTitle")}
              text={t("booking.refusedText", { reason: booking.refusalReason ?? "—" })}
              action={<LinkButton href={`/${locale}/doctors`}>{t("account.findDoctor")}</LinkButton>}
            />
          )}
          {booking.status === "EXPIRED" && (
            <StatusBlock
              title={t("booking.expiredTitle")}
              text={t("booking.expiredText")}
              action={<LinkButton href={`/${locale}/doctors/${booking.doctorId}`}>{t("booking.rebook")}</LinkButton>}
            />
          )}
          {booking.status === "CANCELLED" && <StatusBlock title={t("booking.cancelledTitle")} text={t("booking.cancelledText")} />}

          {booking.status === "CONFIRMED" && booking.paymentDeadline && (
            <Notice tone="warning">
              {t("booking.deadline", { date: formatDateTime(booking.paymentDeadline, locale) })}
            </Notice>
          )}

          {booking.status === "CONFIRMED" && !booking.optionsChosen && (
            <section id="options" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-ink">{t("options.title")}</h2>
              <p className="mt-1 text-muted">
                {t("options.subtitle", {
                  arrival: formatDate(stay.arrivalDate, locale),
                  departure: formatDate(stay.departureDate, locale),
                })}
              </p>
              <div className="mt-6">
                <OptionsForm
                  action={chooseOptionsAction.bind(null, locale, booking.id)}
                  stays={stayOptions}
                  currency={booking.currency}
                  nights={stay.nights}
                  operationPrice={booking.operationPrice}
                  transportPricePerPerson={settings.transportPricePerPerson}
                  maxCompanions={settings.maxCompanions}
                  initial={{
                    withTransport: booking.withTransport,
                    accommodationId: booking.accommodationId,
                    companions: booking.companions,
                  }}
                />
              </div>
            </section>
          )}

          {booking.status === "CONFIRMED" && booking.optionsChosen && (
            <section id="payment" className="scroll-mt-24 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-ink">{t("pay.title")}</h2>
                <form action={editOptionsAction.bind(null, locale, booking.id)}>
                  <Button type="submit" variant="ghost" size="sm" className="underline">
                    {t("pay.editOptions")}
                  </Button>
                </form>
              </div>
              {providers.length === 0 ? (
                <Notice tone="error">{t("errors.providerUnavailable")}</Notice>
              ) : (
                <ActionForm action={startPaymentAction.bind(null, locale, booking.id)} className="space-y-4">
                  <fieldset className="space-y-3">
                    <legend className="mb-3 text-sm font-medium text-ink">{t("pay.method")}</legend>
                    {providers.map((p, i) => (
                      <label key={p.id} className="flex cursor-pointer items-start gap-4 rounded-2xl border-2 border-line p-5 has-[:checked]:border-ink">
                        <input type="radio" name="provider" value={p.id} defaultChecked={i === 0} className="mt-1 h-4 w-4 accent-brand" />
                        <span>
                          <span className="block font-semibold text-ink">{t(`pay.providers.${p.id}.title`)}</span>
                          <span className="block text-sm text-muted">{t(`pay.providers.${p.id}.text`)}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <SubmitButton size="lg" className="w-full">
                    {t("pay.button", { amount: money(booking.totalAmount) })}
                  </SubmitButton>
                  <p className="text-center text-xs text-muted">{t("pay.secure")}</p>
                </ActionForm>
              )}
            </section>
          )}

          {(booking.status === "PAID" || booking.status === "IN_PROGRESS" || booking.status === "COMPLETED") && (
            <section className="space-y-6">
              <div className="rounded-2xl border border-line p-6">
                <h2 className="text-xl font-semibold text-ink">{t("booking.paidTitle")}</h2>
                <p className="mt-2 text-muted">{t("booking.paidText")}</p>
                <LinkButton href={`/${locale}/account/bookings/${booking.id}/ticket`} size="lg" className="mt-6">
                  {t("booking.viewTicket")}
                </LinkButton>
              </div>
              <div className="rounded-2xl border border-line p-6">
                <h2 className="mb-6 text-lg font-semibold text-ink">{t("booking.trackingTitle")}</h2>
                <TrackingTimeline
                  current={booking.trackingStep}
                  hasAccommodation={!!booking.accommodationId}
                  t={t}
                  times={trackingTimes}
                />
              </div>
            </section>
          )}

          {(booking.status === "REQUESTED" || booking.status === "CONFIRMED") && (
            <form action={cancelBookingAction.bind(null, locale, booking.id)} className="border-t border-line pt-6">
              <ConfirmSubmit message={t("booking.cancelConfirm")}>{t("booking.cancel")}</ConfirmSubmit>
            </form>
          )}
        </div>

        <aside>
          <div className="sticky top-28 space-y-5 rounded-2xl border border-line p-6 shadow-float">
            <div className="flex items-center gap-4">
              <Avatar name={`${booking.doctor.user.firstName} ${booking.doctor.user.lastName}`} src={booking.doctor.photoUrl} size={52} />
              <div>
                <p className="font-semibold text-ink">{doctorName}</p>
                <p className="text-sm text-muted">{booking.doctor.clinicName}</p>
              </div>
            </div>
            <dl className="space-y-3 border-t border-line pt-5 text-sm">
              <Row label={t("booking.operationDate")} value={formatDateTime(booking.slot.startsAt, locale)} />
              <Row label={t("booking.arrival")} value={formatDate(stay.arrivalDate, locale)} />
              <Row label={t("booking.departure")} value={formatDate(stay.departureDate, locale)} />
              <Row label={t("booking.recovery")} value={t("booking.nights", { n: booking.recoveryNights })} />
              {booking.optionsChosen && (
                <>
                  <Row label={t("booking.travellers")} value={String(1 + booking.companionsCount)} />
                  <Row label={t("booking.transfer")} value={booking.withTransport ? t("common.yes") : t("common.no")} />
                  <Row label={t("booking.stay")} value={booking.accommodation?.title ?? t("common.no")} />
                </>
              )}
            </dl>
            <dl className="space-y-2 border-t border-line pt-5 text-sm">
              <Row label={t("price.operation")} value={money(booking.operationPrice)} />
              {booking.optionsChosen && (
                <>
                  <Row label={t("price.transport", { n: 1 + booking.companionsCount })} value={money(booking.transportPrice)} />
                  <Row label={t("price.stay", { n: booking.nights })} value={money(booking.accommodationPrice)} />
                </>
              )}
              <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold text-ink">
                <dt>{t("price.total")}</dt>
                <dd data-testid="booking-total">{money(booking.totalAmount)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted">
              {t("booking.support", { phone: settings.supportPhone, email: settings.supportEmail })}
            </p>
          </div>
        </aside>
      </div>
    </Container>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium text-ink">{value}</dd>
    </div>
  );
}

function StatusBlock({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line p-6">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-muted">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
