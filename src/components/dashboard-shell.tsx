import { Header } from "./header";
import { SideNav, TabBar, type NavItem } from "./nav-links";
import type { Locale } from "@/lib/i18n";

/** Pro spaces (doctor, admin): sidebar on desktop, tab bar + "Plus" sheet on phones. */
export function DashboardShell({
  locale,
  title,
  items,
  children,
}: {
  locale: Locale;
  title: string;
  items: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="has-tabbar">
      <Header locale={locale} variant="pro" spaceLabel={title} />
      <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 py-6 sm:px-6 md:py-8 lg:px-10">
        <aside className="no-print hidden w-60 shrink-0 md:block">
          <div className="sticky top-24">
            <SideNav items={items} />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <TabBar items={items} />
    </div>
  );
}
