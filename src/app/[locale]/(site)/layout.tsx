import { Footer, Header } from "@/components/header";
import { TabBar, type NavItem } from "@/components/nav-links";
import { getCurrentUser } from "@/lib/auth";
import { chatOpensBefore } from "@/lib/consultation-rules";
import { db } from "@/lib/db";
import { getT, toLocale } from "@/lib/i18n";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const user = await getCurrentUser();
  const base = `/${locale}`;

  let tabs: NavItem[] | null = null;
  if (!user) {
    tabs = [
      { href: base, label: t("nav.home"), icon: "home", exact: true, tab: true },
      { href: `${base}/doctors`, label: t("nav.consult"), icon: "search", tab: true },
      { href: `${base}/surgery`, label: t("nav.surgery"), icon: "surgery", tab: true },
      { href: `${base}/login`, label: t("nav.login"), icon: "profile", tab: true },
    ];
  } else if (user.role === "PATIENT") {
    // Badge on "Messages" while a consultation chat is open or about to open.
    const live = await db.consultation.count({
      where: { patientId: user.id, status: "PAID", slot: { startsAt: { lte: chatOpensBefore() } } },
    });
    tabs = [
      { href: base, label: t("nav.home"), icon: "home", exact: true, tab: true },
      { href: `${base}/account`, label: t("nav.appointments"), icon: "calendar", exact: true, tab: true, testId: "tab-appointments" },
      { href: `${base}/account/messages`, label: t("nav.messages"), icon: "messages", tab: true, badge: live, testId: "tab-messages" },
      { href: `${base}/account/documents`, label: t("nav.documents"), icon: "documents", tab: true, testId: "tab-documents" },
    ];
  }

  return (
    <div className={tabs ? "has-tabbar" : undefined}>
      <Header locale={locale} />
      <main>{children}</main>
      <Footer locale={locale} />
      {tabs && <TabBar items={tabs} />}
    </div>
  );
}
