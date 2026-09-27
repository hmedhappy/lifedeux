import Link from "next/link";
import { StatusBadge, TrackingTimeline } from "@/components/status";
import { SubmitButton } from "@/components/forms";
import { Card, Notice } from "@/components/ui";
import { advanceStepAction } from "@/actions/scan";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { nextTrackingStep } from "@/lib/tracking";

export default async function ScanTicketPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: raw, token } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const user = await requireRole(locale, ["AGENT", "ADMIN"], `/${locale}/scan/${token}`);

  const b = await db.booking.findUnique({
    where: { qrToken: token },
    include: {
      patient: true,
      companions: true,
      accommodation: true,
      doctor: { include: { user: true } },
      slot: true,
      trackingEvents: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!b) {
    return (
      <div className="space-y-4">
        <Notice tone="error">{t("scan.invalidTicket")}</Notice>
        <Link href={`/${locale}/scan`} className="text-sm underline">
          ← {t("scan.title")}
        </Link>
      </div>
    );
  }

  await db.accessLog.create({ data: { userId: user.id, bookingId: b.id, action: "scan" } });
  const next = b.status === "PAID" || b.status === "IN_PROGRESS" ? nextTrackingStep(b.trackingStep, !!b.accommodationId) : null;
  const times = Object.fromEntries(b.trackingEvents.map((e) => [e.step, `${formatDateTime(e.createdAt, locale)} · ${e.user.firstName}`]));

  return (
    <div className="space-y-6" data-testid="scan-ticket">
      <Link href={`/${locale}/scan`} className="text-sm font-medium underline">
        ← {t("scan.title")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink">
          {b.patient.firstName} {b.patient.lastName}
        </h1>
        <StatusBadge status={b.status} t={t} />
      </div>
      <p className="font-mono text-muted">{b.reference}</p>

      {b.status === "CANCELLED" && <Notice tone="error">{t("scan.cancelled")}</Notice>}

      <div
        className={`rounded-2xl p-5 text-center text-lg font-bold ${b.withTransport ? "bg-emerald-50 text-emerald-700" : "bg-surface text-ink"}`}
        data-testid="scan-transfer"
      >
        {b.withTransport ? t("ticket.transferYes") : t("ticket.transferNo")}
      </div>

      <Card>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Item label={t("fields.phone")} value={b.patient.phone ?? "—"} />
          <Item label={t("ticket.travellers")} value={String(1 + b.companionsCount)} />
          <Item label={t("ticket.stay")} value={b.accommodation ? `${b.accommodation.title} — ${b.accommodation.address}` : t("scan.noStay")} />
          <Item label={t("ticket.clinic")} value={`${b.doctor.clinicName} · Dr ${b.doctor.user.lastName}`} />
          <Item label={t("ticket.appointment")} value={formatDateTime(b.slot.startsAt, locale)} />
          <Item
            label={t("ticket.stayDates")}
            value={b.arrivalDate && b.departureDate ? `${formatDate(b.arrivalDate, locale)} → ${formatDate(b.departureDate, locale)}` : "—"}
          />
        </dl>
        {b.companions.length > 0 && (
          <ul className="mt-5 space-y-1 border-t border-line pt-4 text-sm">
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
      </Card>

      {next ? (
        <form action={advanceStepAction.bind(null, locale, token, next)}>
          <SubmitButton size="lg" className="w-full">
            {t("scan.markStep", { step: t(`tracking.${next}`) })}
          </SubmitButton>
        </form>
      ) : (
        b.status === "COMPLETED" && <Notice tone="success">{t("scan.completed")}</Notice>
      )}

      <Card>
        <h2 className="mb-5 font-semibold text-ink">{t("booking.trackingTitle")}</h2>
        <TrackingTimeline current={b.trackingStep} hasAccommodation={!!b.accommodationId} t={t} times={times} />
      </Card>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}
