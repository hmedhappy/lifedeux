import Link from "next/link";
import { AlertTriangle, ArrowLeft, Plane, Stethoscope } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { StatusBadge, TrackingTimeline } from "@/components/status";
import { OfflineQueue, StepButton } from "@/components/step-button";
import { Card, Disclosure, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { applyStepAction, reportIncidentAction } from "@/actions/scan";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { DOCTOR_ONLY_STEPS, nextTrackingStep } from "@/lib/tracking";

const INCIDENTS = ["late", "health", "lodging", "transport", "other"] as const;

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
      agent: true,
      incidents: { orderBy: { createdAt: "desc" }, take: 5 },
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
  const advance = applyStepAction.bind(null, locale);

  return (
    <div className="space-y-5" data-testid="scan-ticket">
      <Link href={`/${locale}/scan`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-soft">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        {t("scan.title")}
      </Link>
      <OfflineQueue advance={advance} />
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-ink">
            {b.patient.firstName} {b.patient.lastName}
          </h1>
          <StatusBadge status={b.status} t={t} />
        </div>
        <p className="font-mono text-sm text-muted">
          {b.reference}
          {b.agent && ` · ${t("scan.agent")} ${b.agent.firstName}`}
        </p>
      </div>

      {b.status === "CANCELLED" && <Notice tone="error">{t("scan.cancelled")}</Notice>}
      {b.accommodationIssueAt && <Notice tone="warning">{t("scan.lodgingIssue")}</Notice>}

      <div className={`rounded-3xl p-5 text-center text-lg font-bold ${b.withTransport ? "bg-emerald-50 text-emerald-700" : "bg-surface text-ink"}`} data-testid="scan-transfer">
        {b.withTransport ? t("ticket.transferYes") : t("ticket.transferNo")}
      </div>

      {next &&
        (DOCTOR_ONLY_STEPS.includes(next) ? (
          <p className="flex items-center gap-2 rounded-2xl bg-brand-soft p-4 text-sm text-brand-dark" data-testid="scan-doctor-step">
            <Stethoscope className="h-5 w-5 shrink-0" aria-hidden />
            {t("scan.doctorStep")}
          </p>
        ) : (
          <StepButton token={token} step={next} label={t("scan.markStep", { step: t(`tracking.${next}`) })} advance={advance} />
        ))}
      {!next && b.status === "COMPLETED" && <Notice tone="success">{t("scan.completed")}</Notice>}

      <Card>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Item label={t("fields.phone")} value={b.patient.phone ?? "—"} />
          <Item label={t("ticket.travellers")} value={String(1 + b.companionsCount)} />
          <Item
            label={t("scan.flight")}
            value={b.flightNumber ? `${b.flightNumber}${b.flightArrivalAt ? ` · ${formatDateTime(b.flightArrivalAt, locale)}` : ""}` : "—"}
            icon={<Plane className="h-3.5 w-3.5" aria-hidden />}
          />
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
                <span className="font-mono text-muted">{c.passportNumber ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-5 font-semibold text-ink">{t("booking.trackingTitle")}</h2>
        <TrackingTimeline current={b.trackingStep} hasAccommodation={!!b.accommodationId} t={t} times={times} />
      </Card>

      <Disclosure summary={t("incident.title")} className="rounded-3xl border border-line bg-white px-5 py-2 shadow-card">
        <ActionForm action={reportIncidentAction.bind(null, locale, token)} className="space-y-3 pb-3" resetOnSuccess>
          <Field label={t("incident.kind")}>
            <Select name="kind" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {INCIDENTS.map((k) => (
                <option key={k} value={k}>
                  {t(`incident.kinds.${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("incident.note")}>
            <Textarea name="note" rows={3} maxLength={2000} />
          </Field>
          <Field label={t("incident.photo")}>
            <Input type="file" name="photo" accept="image/*" capture="environment" />
          </Field>
          <SubmitButton variant="danger" testId="incident-send">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {t("incident.send")}
          </SubmitButton>
        </ActionForm>
        {b.incidents.length > 0 && (
          <ul className="space-y-1 border-t border-line pb-3 pt-3 text-sm">
            {b.incidents.map((i) => (
              <li key={i.id} className="text-ink-soft">
                {formatDateTime(i.createdAt, locale)} · {t(`incident.kinds.${i.kind}`)}
                {i.note && ` — ${i.note}`}
              </li>
            ))}
          </ul>
        )}
      </Disclosure>
    </div>
  );
}

function Item({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}
