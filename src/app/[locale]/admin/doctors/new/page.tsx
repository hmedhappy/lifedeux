import Link from "next/link";
import { DoctorForm } from "@/components/admin-forms";
import { Card, PageTitle } from "@/components/ui";
import { createDoctorAction } from "@/actions/admin";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, toLocale } from "@/lib/i18n";

export default async function NewDoctorPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const [operations, specialties] = await Promise.all([
    db.operation.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    db.specialty.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <div>
      <Link href={`/${locale}/admin/doctors`} className="text-sm font-medium underline">
        ← {t("admin.doctorsTitle")}
      </Link>
      <div className="mt-4">
        <PageTitle title={t("admin.addDoctor")} subtitle={t("admin.addDoctorSubtitle")} />
      </div>
      <Card>
        <DoctorForm action={createDoctorAction.bind(null, locale)} t={t} locale={locale} operations={operations} specialties={specialties} />
      </Card>
    </div>
  );
}
