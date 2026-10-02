import { EmptyState, PageTitle, Table, Td, Th } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";

/** Trace of sensitive admin actions: prices, refunds, payouts, doctor changes, imports. */
export default async function AdminAuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const logs = await db.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <div className="space-y-6">
      <PageTitle title={t("audit.title")} subtitle={t("audit.subtitle")} />
      {logs.length === 0 ? (
        <EmptyState title={t("audit.empty")} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("payouts.date")}</Th>
              <Th>{t("audit.actor")}</Th>
              <Th>{t("audit.action")}</Th>
              <Th>{t("audit.details")}</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} data-testid="audit-row">
                <Td className="whitespace-nowrap">{formatDateTime(l.createdAt, locale)}</Td>
                <Td>{l.actor.firstName}</Td>
                <Td className="font-mono text-xs">{l.action}</Td>
                <Td className="max-w-md truncate font-mono text-xs text-muted">
                  {l.target ? `${l.target} ` : ""}
                  {l.data ? JSON.stringify(l.data) : ""}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
