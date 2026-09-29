import { DashboardShell } from "@/components/dashboard-shell";
import { requireDoctor } from "@/lib/auth";
import { chatOpensBefore } from "@/lib/consultation-rules";
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
  const { user, doctor } = await requireDoctor(locale);
  const [pendingBookings, pendingConsults, live] = await Promise.all([
    db.booking.count({ where: { doctorId: doctor.id, status: "REQUESTED" } }),
    db.consultation.count({ where: { doctorId: doctor.id, status: "REQUESTED" } }),
    db.consultation.count({
      where: {
        doctorId: doctor.id,
        status: "PAID",
        slot: { startsAt: { lte: chatOpensBefore() } },
      },
    }),
  ]);
  const pending = pendingBookings + pendingConsults;
  const base = `/${locale}/doctor`;
  return (
    <DashboardShell
      locale={locale}
      title={t("doctorArea.title")}
      items={[
        { href: base, label: t("doctorArea.nav.requests"), exact: true, badge: pending },
        { href: `${base}/consultations`, label: t("doctorArea.nav.consultations"), badge: live },
        { href: `${base}/prescription`, label: t("doctorArea.nav.prescription") },
        { href: `${base}/patients`, label: t("doctorArea.nav.patients") },
        { href: `${base}/slots`, label: t("doctorArea.nav.slots") },
        { href: `${base}/payouts`, label: t("doctorArea.nav.payouts") },
        ...(user.role === "SUPER_DOCTOR" ? [{ href: `${base}/referrals`, label: t("doctorArea.nav.referrals") }] : []),
      ]}
    >
      {children}
    </DashboardShell>
  );
}
