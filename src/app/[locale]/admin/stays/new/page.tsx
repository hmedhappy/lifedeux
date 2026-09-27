import Link from "next/link";
import { StayForm } from "@/components/admin-forms";
import { Card, PageTitle } from "@/components/ui";
import { saveStayAction } from "@/actions/admin";
import { requireRole } from "@/lib/auth";
import { getT, toLocale } from "@/lib/i18n";

export default async function NewStayPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  return (
    <div className="space-y-6">
      <Link href={`/${locale}/admin/stays`} className="text-sm font-medium underline">
        ← {t("admin.staysTitle")}
      </Link>
      <PageTitle title={t("admin.addStay")} />
      <Card>
        <StayForm action={saveStayAction.bind(null, locale, null)} t={t} />
      </Card>
    </div>
  );
}
