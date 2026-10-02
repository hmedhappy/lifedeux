import Link from "next/link";
import type { TrackingStep } from "@prisma/client";
import { AlertTriangle, BadgeCheck, CheckCircle2, Clock, Coins, Stamp } from "lucide-react";
import { SubmitButton } from "@/components/forms";
import { Badge, EmptyState, PageTitle, Stat, Table, Td, Th } from "@/components/ui";
import { resolveAlertAction, reviewPriceAction, verifyDoctorAction } from "@/actions/admin-ops";
import { requireRole } from "@/lib/auth";
import { expireOverdueBookings } from "@/lib/bookings";
import { db } from "@/lib/db";
import { addDays, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

const ALERT_KINDS = ["refundFailed", "autoRefund", "incident", "lodgingIssue", "noAnswer"];

function TodoRow({ icon, title, text, href, action }: { icon: React.ReactNode; title: string; text: string; href?: string; action?: React.ReactNode }) {
  const body = (
    <span className="flex min-w-0 flex-1 items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block font-medium text-ink">{title}</span>
        <span className="block truncate text-sm text-muted">{text}</span>
      </span>
    </span>
  );
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5" data-testid="todo-row">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 hover:underline">
          {body}
        </Link>
      ) : (
        body
      )}
      {action}
    </li>
  );
}

const STEPS: TrackingStep[] = ["ARRIVED_AIRPORT", "AT_ACCOMMODATION", "AT_CLINIC", "OPERATED", "RECOVERING"];

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  await expireOverdueBookings();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayAgo = addDays(now, -1);
  const [alerts, lateConsults, lateBookings, stamps, prices, unverified] = await Promise.all([
    db.alert.findMany({ where: { resolvedAt: null }, orderBy: [{ severity: "desc" }, { createdAt: "asc" }], take: 50 }),
    db.consultation.findMany({
      where: { status: "REQUESTED", createdAt: { lt: dayAgo } },
      include: { doctor: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.booking.findMany({ where: { status: "REQUESTED", createdAt: { lt: dayAgo } }, include: { doctor: { include: { user: true } } }, orderBy: { createdAt: "asc" } }),
    db.doctor.findMany({ where: { pendingStampImageId: { not: null } }, include: { user: true } }),
    db.doctor.findMany({ where: { pendingConsultationPrice: { not: null } }, include: { user: true, specialty_: true } }),
    db.doctor.findMany({ where: { referredById: { not: null }, verifiedAt: null }, include: { user: true } }),
  ]);
  // Stamp, price and verification items have their own rows below.
  const shownAlerts = alerts.filter((a) => !["stampToReview", "priceChange"].includes(a.kind));
  const todo = shownAlerts.length + lateConsults.length + lateBookings.length + stamps.length + prices.length + unverified.length;
  const [requested, awaiting, inProgress, revenue, arrivals, settings] = await Promise.all([
    db.booking.count({ where: { status: "REQUESTED" } }),
    db.booking.count({ where: { status: "CONFIRMED" } }),
    db.booking.findMany({
      where: { status: "IN_PROGRESS" },
      include: { patient: true, accommodation: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.payment.aggregate({ where: { status: "SUCCEEDED", updatedAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.booking.findMany({
      where: { status: "PAID", arrivalDate: { gte: addDays(now, -1), lte: addDays(now, 14) } },
      include: { patient: true, accommodation: true, slot: true, doctor: { include: { user: true } } },
      orderBy: { arrivalDate: "asc" },
    }),
    getSettings(),
  ]);

  return (
    <div className="space-y-10">
      <PageTitle title={t("todo.pageTitle")} subtitle={formatDate(now, locale, { weekday: "long" })} />
      <section data-testid="todo">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-ink">{t("todo.title")}</h2>
          {todo > 0 && <Badge tone="amber">{todo}</Badge>}
        </div>
        {todo === 0 ? (
          <p className="flex items-center gap-2 rounded-3xl bg-brand-soft p-5 text-sm font-medium text-brand-dark">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            {t("todo.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-card">
            {shownAlerts.map((a) => (
              <TodoRow
                key={a.id}
                icon={<AlertTriangle className={a.severity === "urgent" ? "h-5 w-5 text-red-600" : "h-5 w-5 text-amber-600"} aria-hidden />}
                title={t(`todo.alert.${ALERT_KINDS.includes(a.kind) ? a.kind : "other"}`)}
                text={`${a.message} · ${formatDateTime(a.createdAt, locale)}`}
                href={a.bookingId ? `/${locale}/admin/bookings/${a.bookingId}` : a.consultationId ? `/${locale}/admin/consultations/${a.consultationId}` : a.doctorId ? `/${locale}/admin/doctors/${a.doctorId}` : undefined}
                action={
                  <form action={resolveAlertAction.bind(null, locale, a.id)}>
                    <SubmitButton size="sm" variant="secondary" testId="alert-resolve">
                      {t("todo.resolve")}
                    </SubmitButton>
                  </form>
                }
              />
            ))}
            {lateConsults.map((c) => (
              <TodoRow
                key={c.id}
                icon={<Clock className="h-5 w-5 text-amber-600" aria-hidden />}
                title={t("todo.lateRequest", { reference: c.reference })}
                text={t("todo.lateText", { doctor: `Dr ${c.doctor.user.lastName}`, date: formatDateTime(c.createdAt, locale) })}
                href={`/${locale}/admin/consultations/${c.id}`}
              />
            ))}
            {lateBookings.map((b) => (
              <TodoRow
                key={b.id}
                icon={<Clock className="h-5 w-5 text-amber-600" aria-hidden />}
                title={t("todo.lateRequest", { reference: b.reference })}
                text={t("todo.lateText", { doctor: `Dr ${b.doctor.user.lastName}`, date: formatDateTime(b.createdAt, locale) })}
                href={`/${locale}/admin/bookings/${b.id}`}
              />
            ))}
            {stamps.map((d) => (
              <TodoRow
                key={`s${d.id}`}
                icon={<Stamp className="h-5 w-5 text-brand" aria-hidden />}
                title={t("todo.stamp", { name: `Dr ${d.user.firstName} ${d.user.lastName}` })}
                text={t("todo.stampText")}
                href={`/${locale}/admin/doctors/${d.id}`}
              />
            ))}
            {prices.map((d) => (
              <TodoRow
                key={`p${d.id}`}
                icon={<Coins className="h-5 w-5 text-brand" aria-hidden />}
                title={t("todo.price", { name: `Dr ${d.user.lastName}` })}
                text={t("todo.priceText", {
                  from: formatMoney(d.consultationPrice ?? d.specialty_?.consultationPrice ?? 0, settings.currency, locale),
                  to: formatMoney(d.pendingConsultationPrice ?? 0, settings.currency, locale),
                })}
                action={
                  <span className="flex gap-2">
                    <form action={reviewPriceAction.bind(null, locale, d.id, false)}>
                      <SubmitButton size="sm" variant="secondary">
                        {t("admin.stampReject")}
                      </SubmitButton>
                    </form>
                    <form action={reviewPriceAction.bind(null, locale, d.id, true)}>
                      <SubmitButton size="sm" testId="price-approve">
                        {t("todo.apply")}
                      </SubmitButton>
                    </form>
                  </span>
                }
              />
            ))}
            {unverified.map((d) => (
              <TodoRow
                key={`v${d.id}`}
                icon={<BadgeCheck className="h-5 w-5 text-brand" aria-hidden />}
                title={t("todo.verify", { name: `Dr ${d.user.firstName} ${d.user.lastName}` })}
                text={t("todo.verifyText", { license: d.licenseNumber ?? "—" })}
                href={`/${locale}/admin/doctors/${d.id}`}
                action={
                  <form action={verifyDoctorAction.bind(null, locale, d.id)}>
                    <SubmitButton size="sm" testId="doctor-verify">
                      {t("todo.verifyButton")}
                    </SubmitButton>
                  </form>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("admin.stats.requested")} value={requested} />
        <Stat label={t("admin.stats.awaiting")} value={awaiting} />
        <Stat label={t("admin.stats.inProgress")} value={inProgress.length} />
        <Stat label={t("admin.stats.revenue")} value={formatMoney(revenue._sum.amount ?? 0, settings.currency, locale)} />
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">{t("admin.liveTitle")}</h2>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {STEPS.map((step) => {
            const list = inProgress.filter((b) => b.trackingStep === step);
            return (
              <div key={step} className="rounded-3xl border border-line bg-surface p-4">
                <p className="flex items-center justify-between text-sm font-semibold text-ink">
                  {t(`tracking.${step}`)}
                  <span className="rounded-full bg-white px-2 text-xs">{list.length}</span>
                </p>
                <ul className="mt-3 space-y-2">
                  {list.map((b) => (
                    <li key={b.id}>
                      <Link href={`/${locale}/admin/bookings/${b.id}`} className="block rounded-lg bg-white p-2.5 text-sm hover:shadow-float">
                        <span className="font-medium">
                          {b.patient.firstName} {b.patient.lastName}
                        </span>
                        <span className="block text-xs text-muted">{b.reference}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">{t("admin.arrivalsTitle")}</h2>
        {arrivals.length === 0 ? (
          <EmptyState title={t("admin.noArrivals")} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("admin.col.arrival")}</Th>
                <Th>{t("admin.col.patient")}</Th>
                <Th>{t("admin.col.travellers")}</Th>
                <Th>{t("admin.col.transfer")}</Th>
                <Th>{t("admin.col.stay")}</Th>
                <Th>{t("admin.col.doctor")}</Th>
              </tr>
            </thead>
            <tbody>
              {arrivals.map((b) => (
                <tr key={b.id}>
                  <Td>{b.arrivalDate ? formatDate(b.arrivalDate, locale) : "—"}</Td>
                  <Td>
                    <Link href={`/${locale}/admin/bookings/${b.id}`} className="font-medium underline">
                      {b.patient.firstName} {b.patient.lastName}
                    </Link>
                    <p className="text-xs text-muted">{b.patient.phone}</p>
                  </Td>
                  <Td>{1 + b.companionsCount}</Td>
                  <Td>{b.withTransport ? t("common.yes") : t("common.no")}</Td>
                  <Td>{b.accommodation?.title ?? "—"}</Td>
                  <Td>
                    Dr {b.doctor.user.lastName}
                    <p className="text-xs text-muted">{formatDateTime(b.slot.startsAt, locale)}</p>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

    </div>
  );
}
