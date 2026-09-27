import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, toLocale } from "@/lib/i18n";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const pending = await db.booking.count({ where: { status: "REQUESTED" } });
  const base = `/${locale}/admin`;
  return (
    <DashboardShell
      locale={locale}
      title={t("admin.title")}
      items={[
        { href: base, label: t("admin.nav.dashboard"), exact: true },
        { href: `${base}/bookings`, label: t("admin.nav.bookings"), badge: pending },
        { href: `/${locale}/scan`, label: t("admin.nav.scan") },
        { href: `${base}/doctors`, label: t("admin.nav.doctors") },
        { href: `${base}/stays`, label: t("admin.nav.stays") },
        { href: `${base}/operations`, label: t("admin.nav.operations") },
        { href: `${base}/payouts`, label: t("admin.nav.payouts") },
        { href: `${base}/team`, label: t("admin.nav.team") },
        { href: `${base}/settings`, label: t("admin.nav.settings") },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
