import { Video } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { StatusBadge } from "@/components/status";
import { EmptyState, Field, Input, Notice, PageTitle } from "@/components/ui";
import { confirmBookingAction, refuseBookingAction } from "@/actions/doctor";
import { confirmConsultationAction, refuseConsultationAction } from "@/actions/consultation";
import { requireDoctor } from "@/lib/auth";
import { expireOverdueBookings } from "@/lib/bookings";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";

export default async function DoctorRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ done?: string; ref?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { done, ref } = await searchParams;
  const t = getT(locale);
  const { doctor } = await requireDoctor(locale);
  await expireOverdueBookings();

  const [consultRequests, requests, awaiting] = await Promise.all([
    db.consultation.findMany({
      where: { doctorId: doctor.id, status: "REQUESTED" },
      include: { patient: true, slot: true },
      orderBy: { slot: { startsAt: "asc" } },
    }),
    db.booking.findMany({
      where: { doctorId: doctor.id, status: "REQUESTED" },
      include: { patient: true, operation: true, slot: true },
      orderBy: { slot: { startsAt: "asc" } },
    }),
    db.booking.findMany({
      where: { doctorId: doctor.id, status: "CONFIRMED" },
      include: { patient: true, operation: true, slot: true },
      orderBy: { slot: { startsAt: "asc" } },
    }),
  ]);

  return (
    <div className="space-y-12">
      <section>
        <PageTitle title={t("doctorArea.requestsTitle")} subtitle={t("doctorArea.requestsSubtitle")} />
        {(done === "confirmed" || done === "refused") && ref && (
          <div className="mb-6">
            <Notice tone="success">{t(`doctorArea.${done}`, { reference: ref })}</Notice>
          </div>
        )}
        {done === "tooLate" && ref && (
          <div className="mb-6">
            <Notice tone="warning">{t("doctorArea.tooLate", { reference: ref })}</Notice>
          </div>
        )}
        {consultRequests.length > 0 && (
          <ul className="mb-8 space-y-4">
            {consultRequests.map((c) => (
              <li key={c.id} className="rounded-2xl border border-line p-6" data-testid="consult-request-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-lg font-semibold text-ink">
                      <Video className="h-5 w-5 text-brand" aria-hidden />
                      {c.patient.firstName} {c.patient.lastName}
                    </p>
                    <p className="text-sm text-muted">
                      {c.patient.country} · {c.patient.phone} · {c.patient.email}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-muted">{c.reference}</span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted">{t("doctorArea.service")}</dt>
                    <dd className="font-medium text-ink">{t("consult.short")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("doctorArea.slot")}</dt>
                    <dd className="font-medium text-ink">{formatDateTime(c.slot.startsAt, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("doctorArea.fee")}</dt>
                    <dd className="font-medium text-ink">{formatMoney(c.doctorFee, c.currency, locale)}</dd>
                  </div>
                </dl>
                {c.reason && (
                  <p className="mt-4 rounded-xl bg-surface p-4 text-sm text-ink">
                    <span className="block text-xs font-semibold text-muted">{t("consult.reason")}</span>
                    {c.reason}
                  </p>
                )}
                <div className="mt-6 grid gap-6 border-t border-line pt-6 md:grid-cols-2">
                  <form action={confirmConsultationAction.bind(null, locale, c.id)} className="flex items-end">
                    <SubmitButton className="w-full">{t("doctorArea.acceptConsult", { name: c.patient.firstName })}</SubmitButton>
                  </form>
                  <ActionForm action={refuseConsultationAction.bind(null, locale, c.id)} className="space-y-3">
                    <Field label={t("doctorArea.refuseReason")}>
                      <Input name="reason" maxLength={500} required />
                    </Field>
                    <SubmitButton
                      variant="danger"
                      className="w-full"
                      confirmMessage={t("doctorArea.refuseConfirm", {
                        name: `${c.patient.firstName} ${c.patient.lastName}`,
                        reference: c.reference,
                      })}
                    >
                      {t("doctorArea.refuse")}
                    </SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
        {requests.length === 0 && consultRequests.length === 0 ? (
          <EmptyState title={t("doctorArea.noRequests")} />
        ) : requests.length === 0 ? null : (
          <ul className="space-y-4">
            {requests.map((b) => (
              <li key={b.id} className="rounded-2xl border border-line p-6" data-testid="request-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-ink">
                      {b.patient.firstName} {b.patient.lastName}
                    </p>
                    <p className="text-sm text-muted">
                      {b.patient.country} · {b.patient.phone} · {b.patient.email}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-muted">{b.reference}</span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted">{t("doctorArea.operation")}</dt>
                    <dd className="font-medium text-ink">{localized(b.operation, "name", locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("doctorArea.slot")}</dt>
                    <dd className="font-medium text-ink">{formatDateTime(b.slot.startsAt, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("doctorArea.fee")}</dt>
                    <dd className="font-medium text-ink">{formatMoney(b.doctorFee, b.currency, locale)}</dd>
                  </div>
                </dl>
                {b.patientNote && (
                  <p className="mt-4 rounded-xl bg-surface p-4 text-sm text-ink">
                    <span className="block text-xs font-semibold text-muted">{t("doctorArea.patientNote")}</span>
                    {b.patientNote}
                  </p>
                )}
                <div className="mt-6 grid gap-6 border-t border-line pt-6 md:grid-cols-2">
                  <ActionForm action={confirmBookingAction.bind(null, locale, b.id)} className="space-y-3">
                    <Field label={t("doctorArea.recoveryNights")} hint={t("doctorArea.recoveryHint")}>
                      <Input type="number" name="recoveryNights" min={1} max={60} defaultValue={b.recoveryNights} required />
                    </Field>
                    <SubmitButton className="w-full">
                      {t("doctorArea.confirmFor", { name: b.patient.firstName })}
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={refuseBookingAction.bind(null, locale, b.id)} className="space-y-3">
                    <Field label={t("doctorArea.refuseReason")}>
                      <Input name="reason" maxLength={500} required />
                    </Field>
                    <SubmitButton
                      variant="danger"
                      className="w-full"
                      confirmMessage={t("doctorArea.refuseConfirm", {
                        name: `${b.patient.firstName} ${b.patient.lastName}`,
                        reference: b.reference,
                      })}
                    >
                      {t("doctorArea.refuse")}
                    </SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-ink">{t("doctorArea.awaitingPayment")}</h2>
        {awaiting.length === 0 ? (
          <p className="text-sm text-muted">{t("doctorArea.noneAwaiting")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {awaiting.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                <span className="font-medium text-ink">
                  {b.patient.firstName} {b.patient.lastName}
                </span>
                <span className="text-muted">{formatDateTime(b.slot.startsAt, locale)}</span>
                <StatusBadge status={b.status} t={t} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
