import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { LiveOptionsSummary, OptionsForm, OptionsProvider, type OptionsConfig, type StayOption } from "@/components/options-form";
import { JourneyStepper, StatusBadge, TrackingTimeline, journeyIndex } from "@/components/status";
import { ArrowLeft, Download, Scissors } from "lucide-react";
import { Avatar, Button, Container, Disclosure, Field, Input, LinkButton, Notice } from "@/components/ui";
import {
  cancelBookingAction,
  chooseOptionsAction,
  chooseOtherAccommodationAction,
  editOptionsAction,
  startPaymentAction,
  updateTripAction,
} from "@/actions/patient";
import { requireRole } from "@/lib/auth";
import { expireOverdueBookings, isAccommodationAvailable } from "@/lib/bookings";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { providersFor } from "@/lib/payments";
import { computeStay } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

/** The agent's name shows from 3 days before; passports can change until 7 days before. */
const AGENT_VISIBLE_DAYS = 3;
const PASSPORT_DAYS = 7;
const nowMs = () => Date.now();

/** "2026-10-05T14:30" in Tunis time, for a datetime-local input. */
function tunisLocalInput(d: Date): string {
  return new Date(d.getTime() + 3_600_000).toISOString().slice(0, 16);
}

async function availableStays(bookingId: string, current: string | null, arrival: Date, departure: Date, travellers: number) {
  const stays = await db.accommodation.findMany({
    where: { active: true, capacity: { gte: travellers }, id: current ? { not: current } : undefined },
    orderBy: { pricePerNight: "asc" },
  });
  const free = await Promise.all(stays.map((s) => isAccommodationAvailable(s.id, arrival, departure, bookingId)));
  return stays.filter((_, i) => free[i]);
}

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
      agent: true,
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

  const optionsConfig: OptionsConfig | null =
    booking.status === "CONFIRMED" && !booking.optionsChosen
      ? {
          stays: stayOptions,
          currency: booking.currency,
          nights: stay.nights,
          operationPrice: booking.operationPrice,
          transportPricePerPerson: settings.transportPricePerPerson,
          maxCompanions: settings.maxCompanions,
          initial: {
            withTransport: booking.withTransport,
            accommodationId: booking.accommodationId,
            companions: booking.companions,
          },
        }
      : null;

  const providers = providersFor(user.country);
  const paid = ["PAID", "IN_PROGRESS"].includes(booking.status);
  const msToOp = booking.slot.startsAt.getTime() - nowMs();
  const showAgent = paid && !!booking.agent && msToOp < AGENT_VISIBLE_DAYS * 86_400_000;
  const passportsOpen = msToOp > PASSPORT_DAYS * 86_400_000;
  const alternatives =
    paid && booking.accommodationIssueAt && booking.arrivalDate && booking.departureDate
      ? await availableStays(booking.id, booking.accommodationId, booking.arrivalDate, booking.departureDate, 1 + booking.companionsCount)
      : [];
  const trackingTimes = Object.fromEntries(booking.trackingEvents.map((e) => [e.step, formatDateTime(e.createdAt, locale)]));

  return (
    <Container className="py-6 sm:py-10">
      <Link href={`/${locale}/account`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        {t("account.title")}
      </Link>
      <header className="mt-2 flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-trip-soft text-trip">
          <Scissors className="h-7 w-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{localized(booking.operation, "name", locale)}</h1>
            <StatusBadge status={booking.status} t={t} />
          </div>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
            <span>{doctorName}</span>
            <span className="font-medium text-ink">{formatDateTime(booking.slot.startsAt, locale)}</span>
            <span className="font-mono text-xs">{booking.reference}</span>
          </p>
        </div>
      </header>

      {step >= 0 && (
        <div className="mt-6 max-w-3xl">
          <JourneyStepper index={step} t={t} />
        </div>
      )}

      <Wrap config={optionsConfig}>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
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
                <OptionsForm action={chooseOptionsAction.bind(null, locale, booking.id)} />
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
                      <label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-line p-4 transition has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40">
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
              <div className="rounded-3xl border border-line bg-white p-6 shadow-card">
                <h2 className="text-lg font-semibold text-ink">{t("booking.paidTitle")}</h2>
                <p className="mt-2 text-muted">{t("booking.paidText")}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <LinkButton href={`/${locale}/account/bookings/${booking.id}/ticket`} size="lg">
                    {t("booking.viewTicket")}
                  </LinkButton>
                  <LinkButton href={`/api/bookings/${booking.id}/ticket`} size="lg" variant="secondary" target="_blank" prefetch={false} data-testid="ticket-pdf">
                    <Download className="h-4 w-4" aria-hidden />
                    {t("trip.pdf")}
                  </LinkButton>
                </div>
              </div>

              {booking.accommodationIssueAt && (
                <div className="rounded-3xl border-2 border-amber-200 bg-amber-50 p-6" data-testid="lodging-issue">
                  <h2 className="font-semibold text-ink">{t("trip.lodgingIssueTitle")}</h2>
                  <p className="mt-1 text-sm text-ink-soft">{t("trip.lodgingIssueText")}</p>
                  {alternatives.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">{t("trip.noAlternative")}</p>
                  ) : (
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                      {alternatives.map((a) => (
                        <li key={a.id} className="rounded-2xl bg-white p-4 shadow-card">
                          <p className="font-semibold text-ink">{a.title}</p>
                          <p className="text-sm text-muted">
                            {a.city} · {t("stays.guests", { n: a.capacity })}
                          </p>
                          <form action={chooseOtherAccommodationAction.bind(null, locale, booking.id, a.id)} className="mt-3">
                            <SubmitButton size="sm">{t("trip.chooseThis")}</SubmitButton>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {showAgent && booking.agent && (
                <div className="flex items-center gap-4 rounded-3xl border border-line bg-white p-5 shadow-card" data-testid="trip-agent">
                  <Avatar name={`${booking.agent.firstName} ${booking.agent.lastName}`} size={48} />
                  <div className="min-w-0">
                    <p className="text-sm text-muted">{t("trip.agentTitle")}</p>
                    <p className="font-semibold text-ink">
                      {booking.agent.firstName} {booking.agent.lastName.charAt(0)}.
                    </p>
                    {booking.agent.phone && (
                      <a href={`tel:${booking.agent.phone}`} className="text-sm font-medium text-brand-dark">
                        {booking.agent.phone}
                      </a>
                    )}
                  </div>
                </div>
              )}

              <section className="rounded-3xl border border-line bg-white p-6 shadow-card" data-testid="trip-prep">
                <h2 className="text-lg font-semibold text-ink">{t("trip.title")}</h2>
                <p className="mt-1 text-sm text-muted">{t("trip.text")}</p>
                <ActionForm action={updateTripAction.bind(null, locale, booking.id)} className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("trip.flightNumber")} hint={t("trip.optional")}>
                      <Input name="flightNumber" defaultValue={booking.flightNumber ?? ""} placeholder="TU 721" className="uppercase" />
                    </Field>
                    <Field label={t("trip.flightArrival")} hint={t("doctor.tunisTime")}>
                      <Input type="datetime-local" name="flightArrivalAt" defaultValue={booking.flightArrivalAt ? tunisLocalInput(booking.flightArrivalAt) : ""} />
                    </Field>
                  </div>
                  {booking.companions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-ink">{t("trip.passports")}</p>
                      {booking.companions.map((c) => (
                        <label key={c.id} className="grid grid-cols-[1fr_1.2fr] items-center gap-3 text-sm">
                          <span className="text-ink-soft">
                            {c.firstName} {c.lastName}
                          </span>
                          <Input name={`passport_${c.id}`} defaultValue={c.passportNumber ?? ""} disabled={!passportsOpen} aria-label={t("fields.passport")} />
                        </label>
                      ))}
                      <p className="text-xs text-muted">{t(passportsOpen ? "trip.passportsUntil" : "trip.passportsClosed")}</p>
                    </div>
                  )}
                  <SubmitButton variant="soft" testId="trip-save">
                    {t("trip.save")}
                  </SubmitButton>
                </ActionForm>
              </section>
              <div className="rounded-3xl border border-line bg-white p-6 shadow-card">
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
            <Disclosure summary={t("consult.moreOptions")}>
              <form action={cancelBookingAction.bind(null, locale, booking.id)}>
                <ConfirmSubmit message={t("booking.cancelConfirm")} variant="danger" testId="booking-cancel">
                  {t("booking.cancel")}
                </ConfirmSubmit>
              </form>
            </Disclosure>
          )}
        </div>

        <aside>
          <div className="space-y-5 rounded-3xl border border-line bg-white p-5 shadow-card lg:sticky lg:top-24">
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
            </dl>
            {optionsConfig ? (
              <LiveOptionsSummary />
            ) : (
              <>
                {booking.optionsChosen && (
                  <dl className="space-y-3 border-t border-line pt-5 text-sm">
                    <Row label={t("booking.travellers")} value={String(1 + booking.companionsCount)} />
                    <Row label={t("booking.transfer")} value={booking.withTransport ? t("common.yes") : t("common.no")} />
                    <Row label={t("booking.stay")} value={booking.accommodation?.title ?? t("common.no")} />
                  </dl>
                )}
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
              </>
            )}
            <p className="text-xs text-muted">
              {t("booking.support", { phone: settings.supportPhone, email: settings.supportEmail })}
            </p>
          </div>
        </aside>
      </div>
      </Wrap>
    </Container>
  );
}

/** Shares live option choices between the form and the sidebar while options are being chosen. */
function Wrap({ config, children }: { config: OptionsConfig | null; children: React.ReactNode }) {
  return config ? <OptionsProvider config={config}>{children}</OptionsProvider> : <>{children}</>;
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
    <div className="rounded-3xl border border-line bg-white p-6 shadow-card">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-muted">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
