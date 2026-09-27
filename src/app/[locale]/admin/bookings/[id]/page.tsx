import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { StatusBadge, TrackingTimeline } from "@/components/status";
import { Badge, Card, LinkButton } from "@/components/ui";
import { adminCancelBookingAction, refundPaymentAction } from "@/actions/admin";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";

export default async function AdminBookingPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: { include: { user: true } },
      operation: true,
      slot: true,
      accommodation: true,
      companions: true,
      payments: { orderBy: { createdAt: "desc" } },
      trackingEvents: { include: { user: true }, orderBy: { createdAt: "asc" } },
      accessLogs: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!b) notFound();
  const money = (v: number) => formatMoney(v, b.currency, locale);
  const times = Object.fromEntries(
    b.trackingEvents.map((e) => [e.step, `${formatDateTime(e.createdAt, locale)} · ${e.user.firstName}`]),
  );

  return (
    <div className="space-y-8">
      <Link href={`/${locale}/admin/bookings`} className="text-sm font-medium underline">
        ← {t("admin.bookingsTitle")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold text-ink">{b.reference}</h1>
        <StatusBadge status={b.status} t={t} />
        {b.qrToken && (
          <LinkButton href={`/${locale}/scan/${b.qrToken}`} variant="secondary" size="sm">
            {t("admin.openTracking")}
          </LinkButton>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-ink">{t("admin.patientTitle")}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label={t("fields.name")} value={`${b.patient.firstName} ${b.patient.lastName}`} />
            <Row label={t("fields.email")} value={b.patient.email} />
            <Row label={t("fields.phone")} value={b.patient.phone ?? "—"} />
            <Row label={t("fields.country")} value={b.patient.country ?? "—"} />
            <Row label={t("admin.col.travellers")} value={String(1 + b.companionsCount)} />
          </dl>
          {b.companions.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
              {b.companions.map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span>
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="font-mono text-muted">{c.passportNumber}</span>
                </li>
              ))}
            </ul>
          )}
          {b.patientNote && <p className="mt-4 rounded-xl bg-surface p-3 text-sm">{b.patientNote}</p>}
        </Card>

        <Card>
          <h2 className="font-semibold text-ink">{t("admin.bookingTitle")}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label={t("admin.col.doctor")} value={`Dr ${b.doctor.user.firstName} ${b.doctor.user.lastName}`} />
            <Row label={t("doctorArea.operation")} value={localized(b.operation, "name", locale)} />
            <Row label={t("admin.col.date")} value={formatDateTime(b.slot.startsAt, locale)} />
            <Row
              label={t("admin.col.stay")}
              value={
                b.arrivalDate && b.departureDate
                  ? `${formatDate(b.arrivalDate, locale)} → ${formatDate(b.departureDate, locale)}`
                  : "—"
              }
            />
            <Row label={t("booking.stay")} value={b.accommodation?.title ?? t("common.no")} />
            <Row label={t("booking.transfer")} value={b.withTransport ? t("common.yes") : t("common.no")} />
            <Row label={t("price.operation")} value={money(b.operationPrice)} />
            <Row label={t("price.transport", { n: 1 + b.companionsCount })} value={money(b.transportPrice)} />
            <Row label={t("price.stay", { n: b.nights })} value={money(b.accommodationPrice)} />
            <Row label={t("price.total")} value={money(b.totalAmount)} />
            <Row label={t("doctorArea.fee")} value={money(b.doctorFee)} />
          </dl>
          {b.refusalReason && <p className="mt-4 text-sm text-red-700">{b.refusalReason}</p>}
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-ink">{t("admin.paymentsTitle")}</h2>
        {b.payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("admin.noPayments")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line text-sm">
            {b.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  {formatDateTime(p.createdAt, locale)} · {p.provider} · {formatMoney(p.amount, p.currency, locale)}
                </span>
                <span className="flex items-center gap-3">
                  <Badge tone={p.status === "SUCCEEDED" ? "green" : p.status === "PENDING" ? "amber" : "gray"}>
                    {t(`paymentStatus.${p.status}`)}
                  </Badge>
                  {p.status === "SUCCEEDED" && (b.status === "CANCELLED" || b.status === "EXPIRED" || b.status === "REFUSED") && (
                    <ActionForm action={refundPaymentAction.bind(null, locale, p.id)}>
                      <SubmitButton size="sm" variant="danger">
                        {t("admin.refund")}
                      </SubmitButton>
                    </ActionForm>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {b.qrToken && (
        <Card>
          <h2 className="mb-5 font-semibold text-ink">{t("booking.trackingTitle")}</h2>
          <TrackingTimeline current={b.trackingStep} hasAccommodation={!!b.accommodationId} t={t} times={times} />
        </Card>
      )}

      {b.accessLogs.length > 0 && (
        <Card>
          <h2 className="font-semibold text-ink">{t("admin.accessLog")}</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {b.accessLogs.map((l) => (
              <li key={l.id}>
                {formatDateTime(l.createdAt, locale)} — {l.user.firstName} {l.user.lastName} ({l.action})
              </li>
            ))}
          </ul>
        </Card>
      )}

      {["REQUESTED", "CONFIRMED", "PAID"].includes(b.status) && (
        <form action={adminCancelBookingAction.bind(null, locale, b.id)}>
          <ConfirmSubmit message={t("admin.cancelConfirm")}>{t("admin.cancelBooking")}</ConfirmSubmit>
        </form>
      )}
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
