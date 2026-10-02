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
  const [pending, todo] = await Promise.all([
    db.booking.count({ where: { status: "REQUESTED" } }),
    db.alert.count({ where: { resolvedAt: null } }),
  ]);
  const base = `/${locale}/admin`;
  return (
    <DashboardShell
      locale={locale}
      title={t("admin.title")}
      items={[
        { href: base, label: t("admin.nav.today"), icon: "tasks", exact: true, badge: todo, tab: true, group: t("admin.nav.groupToday"), testId: "nav-admin-today" },
        { href: `${base}/bookings`, label: t("admin.nav.bookings"), icon: "surgery", badge: pending, tab: true, group: t("admin.nav.groupActivity") },
        { href: `${base}/consultations`, label: t("admin.nav.consultations"), icon: "consultations", tab: true, group: t("admin.nav.groupActivity") },
        { href: `/${locale}/scan`, label: t("admin.nav.scan"), icon: "scan", group: t("admin.nav.groupActivity") },
        { href: `${base}/doctors`, label: t("admin.nav.doctors"), icon: "specialty", group: t("admin.nav.groupCatalogue") },
        { href: `${base}/operations`, label: t("admin.nav.operations"), icon: "surgery", group: t("admin.nav.groupCatalogue") },
        { href: `${base}/specialties`, label: t("admin.nav.specialties"), icon: "specialty", group: t("admin.nav.groupCatalogue") },
        { href: `${base}/medications`, label: t("admin.nav.medications"), icon: "pill", group: t("admin.nav.groupCatalogue") },
        { href: `${base}/stays`, label: t("admin.nav.stays"), icon: "stays", group: t("admin.nav.groupCatalogue") },
        { href: `${base}/import`, label: t("admin.nav.import"), icon: "upload", group: t("admin.nav.groupCatalogue"), testId: "nav-import" },
        { href: `${base}/payouts`, label: t("admin.nav.payouts"), icon: "wallet", group: t("admin.nav.groupFinance") },
        { href: `${base}/audit`, label: t("admin.nav.audit"), icon: "audit", group: t("admin.nav.groupFinance"), testId: "nav-audit" },
        { href: `${base}/team`, label: t("admin.nav.team"), icon: "patients", group: t("admin.nav.groupSettings") },
        { href: `${base}/settings`, label: t("admin.nav.settings"), icon: "settings", group: t("admin.nav.groupSettings") },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
