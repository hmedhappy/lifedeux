import { StatusBadge } from "@/components/status";
import { Button, EmptyState, PageTitle, Table, Td, Th } from "@/components/ui";
import { markOperatedAction } from "@/actions/doctor";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { trackingSequence } from "@/lib/tracking";

export default async function DoctorPatientsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { doctor } = await requireDoctor(locale);
  const bookings = await db.booking.findMany({
    where: { doctorId: doctor.id, status: { in: ["PAID", "IN_PROGRESS", "COMPLETED"] } },
    include: { patient: true, operation: true, slot: true, accommodation: true },
    orderBy: { slot: { startsAt: "asc" } },
  });

  return (
    <div>
      <PageTitle title={t("doctorArea.patientsTitle")} subtitle={t("doctorArea.patientsSubtitle")} />
      {bookings.length === 0 ? (
        <EmptyState title={t("doctorArea.noPatients")} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("doctorArea.patient")}</Th>
              <Th>{t("doctorArea.slot")}</Th>
              <Th>{t("doctorArea.stay")}</Th>
              <Th>{t("doctorArea.step")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const seq = trackingSequence(!!b.accommodationId);
              const canOperate =
                (b.status === "PAID" || b.status === "IN_PROGRESS") &&
                seq.indexOf(b.trackingStep ?? "ARRIVED_AIRPORT") < seq.indexOf("OPERATED");
              return (
                <tr key={b.id}>
                  <Td>
                    <p className="font-medium">
                      {b.patient.firstName} {b.patient.lastName}
                    </p>
                    <p className="text-xs text-muted">
                      {b.reference} · {localized(b.operation, "name", locale)}
                    </p>
                  </Td>
                  <Td>{formatDateTime(b.slot.startsAt, locale)}</Td>
                  <Td>
                    {b.arrivalDate && b.departureDate
                      ? `${formatDate(b.arrivalDate, locale, { year: undefined })} → ${formatDate(b.departureDate, locale, { year: undefined })}`
                      : "—"}
                    <p className="text-xs text-muted">{b.accommodation?.title ?? t("doctorArea.ownStay")}</p>
                  </Td>
                  <Td>
                    <StatusBadge status={b.status} t={t} />
                    {b.trackingStep && <p className="mt-1 text-xs text-muted">{t(`tracking.${b.trackingStep}`)}</p>}
                  </Td>
                  <Td>
                    {canOperate && (
                      <form action={markOperatedAction.bind(null, locale, b.id)}>
                        <Button type="submit" size="sm" variant="secondary">
                          {t("doctorArea.markOperated")}
                        </Button>
                      </form>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
