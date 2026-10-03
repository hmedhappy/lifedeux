import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Scissors } from "lucide-react";
import { SubmitButton } from "@/components/forms";
import { StatusBadge, TrackingTimeline } from "@/components/status";
import { Card, LinkButton, Notice } from "@/components/ui";
import { markOperatedAction } from "@/actions/doctor";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { trackingSequence } from "@/lib/tracking";

/** The surgeon's view of one operation booking, opened from the agenda. */
export default async function DoctorBookingPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const { doctor } = await requireDoctor(locale);
  const b = await db.booking.findFirst({
    where: { id, doctorId: doctor.id },
    include: { patient: true, operation: true, slot: true, accommodation: true, trackingEvents: { orderBy: { createdAt: "asc" } } },
  });
  if (!b) notFound();
  const paid = ["PAID", "IN_PROGRESS", "COMPLETED"].includes(b.status);
  const seq = trackingSequence(!!b.accommodationId);
  const canOperate = (b.status === "PAID" || b.status === "IN_PROGRESS") && seq.indexOf(b.trackingStep ?? "ARRIVED_AIRPORT") < seq.indexOf("OPERATED");
  const times = Object.fromEntries(b.trackingEvents.map((e) => [e.step, formatDateTime(e.createdAt, locale)]));
  const money = (v: number) => formatMoney(v, b.currency, locale);

  return (
    <div className="space-y-5" data-testid="doctor-booking">
      <Link href={`/${locale}/doctor/slots`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        {t("agenda.back")}
      </Link>
      <header className="flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Scissors className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-ink">{localized(b.operation, "name", locale)}</h1>
            <StatusBadge status={b.status} t={t} />
          </div>
          <p className="text-sm text-muted">
            {formatDateTime(b.slot.startsAt, locale)} · <span className="font-mono">{b.reference}</span>
          </p>
        </div>
      </header>

      {b.status === "REQUESTED" && (
        <Notice tone="info">
          {t("agenda.requestHint")}{" "}
          <Link href={`/${locale}/doctor`} className="font-semibold underline">
            {t("doctorArea.nav.today")}
          </Link>
        </Notice>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-ink">{t("doctorArea.patient")}</h2>
          <dl className="space-y-2 text-sm">
            <Row label={t("fields.lastName")} value={paid ? `${b.patient.firstName} ${b.patient.lastName}` : `${b.patient.firstName} ${b.patient.lastName.charAt(0)}.`} />
            <Row label={t("fields.country")} value={b.patient.country ?? "—"} />
            {paid ? (
              <>
                <Row label={t("fields.email")} value={b.patient.email} />
                <Row label={t("fields.phone")} value={b.patient.phone ?? "—"} />
              </>
            ) : (
              <p className="text-xs text-muted">{t("inbox.contactsLater")}</p>
            )}
            <Row label={t("ticket.travellers")} value={String(1 + b.companionsCount)} />
            {b.flightNumber && <Row label={t("scan.flight")} value={`${b.flightNumber}${b.flightArrivalAt ? ` · ${formatDateTime(b.flightArrivalAt, locale)}` : ""}`} />}
          </dl>
          {b.patientNote && (
            <p className="mt-3 rounded-2xl bg-surface p-3 text-sm text-ink">
              <span className="block text-xs font-semibold text-muted">{t("doctorArea.patientNote")}</span>
              {b.patientNote}
            </p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-ink">{t("doctorArea.stay")}</h2>
          <dl className="space-y-2 text-sm">
            <Row
              label={t("ticket.stayDates")}
              value={b.arrivalDate && b.departureDate ? `${formatDate(b.arrivalDate, locale)} → ${formatDate(b.departureDate, locale)}` : "—"}
            />
            <Row label={t("booking.recovery")} value={t("booking.nights", { n: b.recoveryNights })} />
            <Row label={t("ticket.stay")} value={b.accommodation?.title ?? t("doctorArea.ownStay")} />
            <Row label={t("doctorArea.fee")} value={money(b.doctorFee)} />
          </dl>
        </Card>
      </div>

      {canOperate && (
        <form action={markOperatedAction.bind(null, locale, b.id)}>
          <SubmitButton size="lg" testId="booking-operated">
            {t("doctorArea.markOperated")}
          </SubmitButton>
        </form>
      )}

      {paid && (
        <Card>
          <h2 className="mb-5 font-semibold text-ink">{t("booking.trackingTitle")}</h2>
          <TrackingTimeline current={b.trackingStep} hasAccommodation={!!b.accommodationId} t={t} times={times} />
        </Card>
      )}

      <LinkButton href={`/${locale}/doctor/patients`} variant="ghost">
        {t("doctorArea.nav.patients")}
      </LinkButton>
    </div>
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
