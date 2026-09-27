import Link from "next/link";
import { StayCard } from "@/components/cards";
import { Badge, EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, toLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export default async function AdminStaysPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const [stays, settings] = await Promise.all([db.accommodation.findMany({ orderBy: { createdAt: "desc" } }), getSettings()]);

  return (
    <div>
      <PageTitle
        title={t("admin.staysTitle")}
        subtitle={t("admin.staysSubtitle")}
        action={<LinkButton href={`/${locale}/admin/stays/new`}>{t("admin.addStay")}</LinkButton>}
      />
      {stays.length === 0 ? (
        <EmptyState title={t("stays.empty")} />
      ) : (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {stays.map((s) => (
            <Link key={s.id} href={`/${locale}/admin/stays/${s.id}`} className="block">
              <StayCard
                stay={s}
                locale={locale}
                t={t}
                currency={settings.currency}
                footer={<div className="mt-2">{s.active ? <Badge tone="green">{t("admin.active")}</Badge> : <Badge>{t("admin.inactive")}</Badge>}</div>}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
