import Link from "next/link";
import { notFound } from "next/navigation";
import { DoctorForm } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageTitle } from "@/components/ui";
import { resendInviteAction, updateDoctorAction } from "@/actions/admin";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, toLocale } from "@/lib/i18n";

export default async function EditDoctorPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const [doctor, operations] = await Promise.all([
    db.doctor.findUnique({ where: { id }, include: { user: true, operations: true } }),
    db.operation.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  if (!doctor) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/${locale}/admin/doctors`} className="text-sm font-medium underline">
        ← {t("admin.doctorsTitle")}
      </Link>
      <PageTitle title={`Dr ${doctor.user.firstName} ${doctor.user.lastName}`} subtitle={doctor.user.email} />
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
          doctor={doctor}
        />
      </Card>
    </div>
  );
}
