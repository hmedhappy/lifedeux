import Link from "next/link";
import { OperationForm } from "@/components/admin-forms";
import { Badge, Card, PageTitle, Table, Td, Th } from "@/components/ui";
import { saveOperationAction } from "@/actions/admin";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export default async function AdminOperationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const [operations, settings] = await Promise.all([
    db.operation.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { doctors: true } } } }),
    getSettings(),
  ]);

  return (
    <div className="space-y-10">
      <PageTitle title={t("admin.operationsTitle")} subtitle={t("admin.operationsSubtitle")} />
      <Table>
        <thead>
          <tr>
            <Th>{t("admin.operation.name")}</Th>
            <Th>{t("admin.operation.basePrice")}</Th>
            <Th>{t("admin.operation.recovery")}</Th>
            <Th>{t("admin.nav.doctors")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {operations.map((op) => (
            <tr key={op.id}>
              <Td>
                <Link href={`/${locale}/admin/operations/${op.id}`} className="font-medium underline">
                  {localized(op, "name", locale)}
                </Link>
                <p className="text-xs text-muted">{op.slug}</p>
              </Td>
              <Td>{formatMoney(op.basePrice, settings.currency, locale)}</Td>
              <Td>{t("booking.nights", { n: op.defaultRecoveryNights })}</Td>
              <Td>{op._count.doctors}</Td>
              <Td>{op.active ? <Badge tone="green">{t("admin.active")}</Badge> : <Badge>{t("admin.inactive")}</Badge>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card>
        <h2 className="mb-5 text-lg font-semibold text-ink">{t("admin.addOperation")}</h2>
        <OperationForm action={saveOperationAction.bind(null, locale, null)} t={t} />
      </Card>
    </div>
  );
}
