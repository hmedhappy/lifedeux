import { Header } from "./header";
import { NavLinks, type NavItem } from "./nav-links";
import type { Locale } from "@/lib/i18n";

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
    <>
      <Header locale={locale} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:px-10">
        <aside className="no-print lg:w-60 lg:shrink-0">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
          <NavLinks items={items} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
