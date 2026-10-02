import Link from "next/link";
import { StatusBadge } from "@/components/status";
import { Avatar, Badge, EmptyState, PageTitle } from "@/components/ui";
import { requireDoctor } from "@/lib/auth";
import { expireOverdueBookings } from "@/lib/bookings";
import { chatState } from "@/lib/consultation-rules";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";

export default async function DoctorConsultationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { doctor } = await requireDoctor(locale);
  await expireOverdueBookings();
  const consultations = await db.consultation.findMany({
    where: { doctorId: doctor.id, status: { in: ["CONFIRMED", "PAID", "COMPLETED"] } },
    include: { patient: true, slot: true, _count: { select: { prescriptions: { where: { status: "ISSUED" } } } } },
    orderBy: { slot: { startsAt: "asc" } },
  });
  const done = (c: { status: string }) => c.status === "COMPLETED" || c.status === "NO_SHOW";
  const upcoming = consultations.filter((c) => !done(c));
  const past = consultations.filter(done).reverse();

  const list = (items: typeof consultations) => (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-card">
      {items.map((c) => {
        const state = chatState(c);
        return (
          <li key={c.id}>
            <Link
              href={`/${locale}/doctor/consultations/${c.id}`}
              className="flex items-start gap-3 px-4 py-4 transition hover:bg-surface sm:items-center sm:gap-4 sm:px-5"
              data-testid="doctor-consultation"
            >
              <Avatar name={`${c.patient.firstName} ${c.patient.lastName}`} size={40} />
              {/* Phones: price and badges go under the name, so the date keeps its line. */}
              <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                <div className="min-w-0 sm:flex-1">
                  <p className="truncate font-medium text-ink">
                    {c.patient.firstName} {c.patient.lastName}
                  </p>
                  <p className="text-sm text-muted">
                    {formatDateTime(c.slot.startsAt, locale)} · {c.reference}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0 sm:shrink-0 sm:gap-3">
                  <span className="text-sm text-muted">{formatMoney(c.doctorFee, c.currency, locale)}</span>
                  {c.rescheduleSlotId && <Badge tone="amber">{t("doctorArea.moveAsked")}</Badge>}
                  {c._count.prescriptions > 0 && <Badge tone="blue">{t("rx.count", { n: c._count.prescriptions })}</Badge>}
                  {state === "open" ? <Badge tone="green">{t("chat.live")}</Badge> : <StatusBadge status={c.status} t={t} />}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-10">
      <PageTitle title={t("doctorArea.consultationsTitle")} subtitle={t("doctorArea.consultationsSubtitle")} />
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">{t("doctorArea.upcoming")}</h2>
        {upcoming.length === 0 ? <EmptyState title={t("doctorArea.noConsultations")} /> : list(upcoming)}
      </section>
      {past.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-ink">{t("doctorArea.past")}</h2>
          {list(past)}
        </section>
      )}
    </div>
  );
}
