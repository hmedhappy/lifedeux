import { DashboardShell } from "@/components/dashboard-shell";
import { requireDoctor } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, toLocale } from "@/lib/i18n";

export default async function DoctorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { doctor } = await requireDoctor(locale);
  const pending = await db.booking.count({ where: { doctorId: doctor.id, status: "REQUESTED" } });
  const base = `/${locale}/doctor`;
  return (
    <DashboardShell
      locale={locale}
      title={t("doctorArea.title")}
      items={[
        { href: base, label: t("doctorArea.nav.requests"), exact: true, badge: pending },
        { href: `${base}/patients`, label: t("doctorArea.nav.patients") },
        { href: `${base}/slots`, label: t("doctorArea.nav.slots") },
        { href: `${base}/payouts`, label: t("doctorArea.nav.payouts") },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
