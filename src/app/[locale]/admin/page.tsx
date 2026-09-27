import Link from "next/link";
import type { TrackingStep } from "@prisma/client";
import { EmptyState, PageTitle, Stat, Table, Td, Th } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { expireOverdueBookings } from "@/lib/bookings";
import { db } from "@/lib/db";
import { addDays, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

const STEPS: TrackingStep[] = ["ARRIVED_AIRPORT", "AT_ACCOMMODATION", "AT_CLINIC", "OPERATED", "RECOVERING"];

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  await expireOverdueBookings();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
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
      <PageTitle title={t("admin.dashboardTitle")} subtitle={formatDate(now, locale, { weekday: "long" })} />
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
              <div key={step} className="rounded-2xl border border-line bg-surface p-4">
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
