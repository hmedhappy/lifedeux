import Link from "next/link";
import { Mail } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Button, EmptyState, Input, LinkButton, PageTitle, Table, Td, Th } from "@/components/ui";
import { inviteDoctorByEmailAction, resendDoctorInviteAction } from "@/actions/onboarding";
import { requireRole } from "@/lib/auth";
import { prescriptionReadiness } from "@/lib/doctor-readiness";
import type { TFunction } from "@/lib/i18n";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export default async function AdminDoctorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const [doctors, settings, invites] = await Promise.all([
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
    db.doctorInvite.findMany({ where: { usedAt: null }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const now = new Date();
  // Only the latest link per address matters; older ones were replaced.
  const pending = invites.filter((inv, i) => invites.findIndex((o) => o.email === inv.email) === i);

  return (
    <div>
      <PageTitle
        title={t("admin.doctorsTitle")}
        subtitle={t("admin.doctorsSubtitle")}
        action={<LinkButton href={`/${locale}/admin/doctors/new`}>{t("admin.addDoctor")}</LinkButton>}
      />
      <section className="mb-6 rounded-2xl border border-line bg-white p-5 shadow-card" data-testid="doctor-invite">
        <h2 className="flex items-center gap-2 font-semibold text-ink">
          <Mail className="h-4 w-4 text-brand" aria-hidden />
          {t("admin.doctorInvite.title")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("admin.doctorInvite.text")}</p>
        <ActionForm action={inviteDoctorByEmailAction.bind(null, locale)} className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" name="email" required placeholder="dr.nom@exemple.com" aria-label={t("fields.email")} className="sm:max-w-sm" data-testid="doctor-invite-email" />
            <SubmitButton testId="doctor-invite-send">{t("admin.doctorInvite.send")}</SubmitButton>
          </div>
        </ActionForm>
        {pending.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("admin.doctorInvite.pending")}</h3>
            <ul className="mt-2 divide-y divide-line">
              {pending.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{inv.email}</span>
                    <span className="text-xs text-muted">{t("admin.doctorInvite.sentOn", { date: formatDate(inv.createdAt, locale) })}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {inv.expiresAt < now ? <Badge>{t("admin.doctorInvite.expired")}</Badge> : <Badge tone="amber">{t("admin.invitePending")}</Badge>}
                    <form action={resendDoctorInviteAction.bind(null, locale, inv.id)}>
                      <Button type="submit" size="sm" variant="secondary">
                        {t("admin.doctorInvite.resend")}
                      </Button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

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
                  {d.user.inviteToken && !d.user.passwordHash ? (
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
