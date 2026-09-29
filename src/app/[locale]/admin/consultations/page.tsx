import { StatusBadge } from "@/components/status";
import { EmptyState, PageTitle, Table, Td, Th } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { expireOverdueBookings } from "@/lib/bookings";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";

export default async function AdminConsultationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  await expireOverdueBookings();
  const consultations = await db.consultation.findMany({
    include: {
      patient: true,
      slot: true,
      doctor: { include: { user: true, specialty_: true } },
      _count: { select: { messages: true, prescriptions: { where: { status: "ISSUED" } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageTitle title={t("admin.consultationsTitle")} subtitle={t("admin.consultationsSubtitle")} />
      {consultations.length === 0 ? (
        <EmptyState title={t("doctorArea.noConsultations")} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("booking.reference")}</Th>
              <Th>{t("doctorArea.patient")}</Th>
              <Th>{t("admin.col.doctor")}</Th>
              <Th>{t("doctorArea.slot")}</Th>
              <Th>{t("price.total")}</Th>
              <Th>{t("admin.col.activity")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {consultations.map((c) => (
              <tr key={c.id}>
                <Td className="font-mono">{c.reference}</Td>
                <Td>
                  {c.patient.firstName} {c.patient.lastName}
                  <p className="text-xs text-muted">{c.patient.email}</p>
                </Td>
                <Td>
                  Dr {c.doctor.user.firstName} {c.doctor.user.lastName}
                  <p className="text-xs text-muted">{c.doctor.specialty_ ? localized(c.doctor.specialty_, "name", locale) : c.doctor.specialty}</p>
                </Td>
                <Td>{formatDateTime(c.slot.startsAt, locale)}</Td>
                <Td>
                  {formatMoney(c.price, c.currency, locale)}
                  <p className="text-xs text-muted">{t("admin.col.fee", { amount: formatMoney(c.doctorFee, c.currency, locale) })}</p>
                </Td>
                <Td className="text-xs text-muted">
                  {t("admin.col.messages", { n: c._count.messages })}
                  <br />
                  {t("rx.count", { n: c._count.prescriptions })}
                </Td>
                <Td>
                  <StatusBadge status={c.status} t={t} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
