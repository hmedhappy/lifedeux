import Link from "next/link";
import { Avatar, Badge, EmptyState, LinkButton, PageTitle, Table, Td, Th } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { prescriptionReadiness } from "@/lib/doctor-readiness";
import type { TFunction } from "@/lib/i18n";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export default async function AdminDoctorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const [doctors, settings] = await Promise.all([
    db.doctor.findMany({
      include: {
        user: true,
        operations: true,
        specialty_: true,
        _count: { select: { slots: { where: { status: "FREE", startsAt: { gt: new Date() } } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getSettings(),
  ]);

  return (
    <div>
      <PageTitle
        title={t("admin.doctorsTitle")}
        subtitle={t("admin.doctorsSubtitle")}
        action={<LinkButton href={`/${locale}/admin/doctors/new`}>{t("admin.addDoctor")}</LinkButton>}
      />
      {doctors.length === 0 ? (
        <EmptyState title={t("admin.noDoctors")} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("admin.col.doctor")}</Th>
              <Th>{t("admin.doctor.clinicName")}</Th>
              <Th>{t("admin.doctor.price")}</Th>
              <Th>{t("admin.col.freeSlots")}</Th>
              <Th>{t("admin.col.account")}</Th>
              <Th>{t("ready.col")}</Th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((d) => (
              <tr key={d.id}>
                <Td>
                  <Link href={`/${locale}/admin/doctors/${d.id}`} className="flex items-center gap-3">
                    <Avatar name={`${d.user.firstName} ${d.user.lastName}`} src={d.photoUrl} size={36} />
                    <span>
                      <span className="block font-medium underline">
                        Dr {d.user.firstName} {d.user.lastName}
                      </span>
                      <span className="text-xs text-muted">{d.user.email}</span>
                      <span className="block text-xs text-muted">
                        {d.specialty_ ? localized(d.specialty_, "name", locale) : d.specialty}
                        {d.user.role === "SUPER_DOCTOR" ? ` · ${t("admin.doctor.superBadge")}` : ""}
                        {!d.stampImageId ? ` · ${t("admin.doctor.noStamp")}` : ""}
                      </span>
                    </span>
                  </Link>
                </Td>
                <Td>
                  {d.clinicName}
                  <p className="text-xs text-muted">{d.city}</p>
                </Td>
                <Td>
                  {d.offersConsultation && <span className="block text-xs text-muted">{t("consult.short")}</span>}
                  {d.operations.map((o) => (
                    <span key={o.operationId} className="block">
                      {formatMoney(o.price, settings.currency, locale)}
                    </span>
                  ))}
                </Td>
                <Td>{d._count.slots}</Td>
                <Td>
                  {!d.user.passwordHash ? (
                    <Badge tone="amber">{t("admin.invitePending")}</Badge>
                  ) : d.active && d.user.active ? (
                    <Badge tone="green">{t("admin.active")}</Badge>
                  ) : (
                    <Badge>{t("admin.inactive")}</Badge>
                  )}
                </Td>
                <Td>
                  <ReadyBadge t={t} doctor={d} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function ReadyBadge({ t, doctor }: { t: TFunction; doctor: Parameters<typeof prescriptionReadiness>[0] }) {
  const r = prescriptionReadiness(doctor);
  return r.ready ? (
    <Badge tone="green">{t("ready.yes")}</Badge>
  ) : (
    <span title={r.missing.map((m) => t(`ready.missing.${m}`)).join(", ")}>
      <Badge tone="amber">{t("ready.no", { n: r.missing.length })}</Badge>
    </span>
  );
}
