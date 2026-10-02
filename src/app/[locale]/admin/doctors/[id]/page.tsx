import Link from "next/link";
import { notFound } from "next/navigation";
import { DoctorForm } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageTitle } from "@/components/ui";
import { resendInviteAction, reviewStampAction, updateDoctorAction } from "@/actions/admin";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, toLocale, type TFunction } from "@/lib/i18n";
import { prescriptionReadiness } from "@/lib/doctor-readiness";

export default async function EditDoctorPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const [doctor, operations, specialties] = await Promise.all([
    db.doctor.findUnique({ where: { id }, include: { user: true, operations: true } }),
    db.operation.findMany({ orderBy: { createdAt: "asc" } }),
    db.specialty.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!doctor) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/${locale}/admin/doctors`} className="text-sm font-medium underline">
        ← {t("admin.doctorsTitle")}
      </Link>
      <PageTitle title={`Dr ${doctor.user.firstName} ${doctor.user.lastName}`} subtitle={doctor.user.email} />
      <ReadyLine t={t} doctor={doctor} />
      {doctor.pendingStampImageId && (
        <Card>
          <div className="flex flex-wrap items-center gap-5" data-testid="stamp-review">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/doctors/${doctor.id}/pending-stamp`} alt={t("admin.doctor.stamp")} className="h-28 w-28 rounded-2xl border border-line bg-white object-contain p-2" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-ink">{t("admin.stampReviewTitle")}</h2>
              <p className="mt-1 text-sm text-muted">{t("admin.stampReviewText")}</p>
              <div className="mt-3 flex gap-2">
                <form action={reviewStampAction.bind(null, locale, doctor.id, false)}>
                  <SubmitButton variant="secondary" size="sm">
                    {t("admin.stampReject")}
                  </SubmitButton>
                </form>
                <form action={reviewStampAction.bind(null, locale, doctor.id, true)}>
                  <SubmitButton size="sm" testId="stamp-approve">
                    {t("admin.stampApprove")}
                  </SubmitButton>
                </form>
              </div>
            </div>
          </div>
        </Card>
      )}
      <Card>
        <h2 className="font-semibold text-ink">{t("admin.inviteTitle")}</h2>
        <p className="mt-1 text-sm text-muted">
          {doctor.user.passwordHash ? t("admin.inviteDoneText") : t("admin.invitePendingText")}
        </p>
        <ActionForm action={resendInviteAction.bind(null, locale, doctor.userId)} className="mt-4">
          <SubmitButton variant="secondary" size="sm">
            {doctor.user.passwordHash ? t("admin.sendResetLink") : t("admin.resendInvite")}
          </SubmitButton>
        </ActionForm>
      </Card>
      <Card>
        <DoctorForm
          action={updateDoctorAction.bind(null, locale, doctor.id)}
          t={t}
          locale={locale}
          operations={operations}
          specialties={specialties}
          doctor={doctor}
        />
      </Card>
    </div>
  );
}

function ReadyLine({ t, doctor }: { t: TFunction; doctor: Parameters<typeof prescriptionReadiness>[0] }) {
  const r = prescriptionReadiness(doctor);
  return (
    <p
      className={`rounded-2xl px-4 py-3 text-sm font-medium ${r.ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
      data-testid="ready-line"
    >
      {r.ready ? t("ready.yesLong") : t("ready.noLong", { missing: r.missing.map((m) => t(`ready.missing.${m}`)).join(", ") })}
    </p>
  );
}
