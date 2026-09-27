import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationForm } from "@/components/admin-forms";
import { Card, PageTitle } from "@/components/ui";
import { saveOperationAction } from "@/actions/admin";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, localized, toLocale } from "@/lib/i18n";

export default async function EditOperationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const operation = await db.operation.findUnique({ where: { id } });
  if (!operation) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/${locale}/admin/operations`} className="text-sm font-medium underline">
        ← {t("admin.operationsTitle")}
      </Link>
      <PageTitle title={localized(operation, "name", locale)} />
      <Card>
        <OperationForm action={saveOperationAction.bind(null, locale, operation.id)} t={t} operation={operation} />
      </Card>
    </div>
  );
}
