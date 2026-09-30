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
        { href: base, label: t("doctorArea.nav.today"), icon: "today", exact: true, badge: pending, tab: true, group: t("doctorArea.nav.groupDaily"), testId: "nav-today" },
        { href: `${base}/consultations`, label: t("doctorArea.nav.consultations"), icon: "consultations", badge: live, tab: true, group: t("doctorArea.nav.groupDaily"), testId: "nav-consultations" },
        { href: `${base}/slots`, label: t("doctorArea.nav.agenda"), icon: "agenda", tab: true, group: t("doctorArea.nav.groupDaily"), testId: "nav-agenda" },
        { href: `${base}/patients`, label: t("doctorArea.nav.patients"), icon: "patients", group: t("doctorArea.nav.groupDaily") },
        { href: `${base}/payouts`, label: t("doctorArea.nav.payouts"), icon: "wallet", group: t("doctorArea.nav.groupSettings") },
        { href: `${base}/prescription`, label: t("doctorArea.nav.prescription"), icon: "prescription", group: t("doctorArea.nav.groupSettings") },
        { href: `${base}/profile`, label: t("doctorArea.nav.profile"), icon: "profile", group: t("doctorArea.nav.groupSettings"), testId: "nav-profile" },
        ...(user.role === "SUPER_DOCTOR"
          ? [{ href: `${base}/referrals`, label: t("doctorArea.nav.referrals"), icon: "referral" as const, group: t("doctorArea.nav.groupSettings") }]
          : []),
      ]}
    >
      {children}
    </DashboardShell>
  );
}
