"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  BedDouble,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FileText,
  Gift,
  Home,
  LayoutGrid,
  MessageCircle,
  Pill,
  ScanLine,
  Scissors,
  Search,
  Settings,
  Stethoscope,
  Sun,
  UserRound,
  Users,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "./i18n-provider";
import { Sheet } from "./overlay";

/** Icons are named (not passed as components) so server layouts can describe the navigation. */
const ICONS = {
  home: Home,
  search: Search,
  calendar: CalendarDays,
  agenda: CalendarClock,
  messages: MessageCircle,
  documents: FileText,
  today: Sun,
  consultations: Video,
  patients: Users,
  wallet: Wallet,
  prescription: FileSignature,
  referral: Gift,
  profile: UserRound,
  surgery: Scissors,
  stays: BedDouble,
  pill: Pill,
  specialty: Stethoscope,
  settings: Settings,
  scan: ScanLine,
  tasks: ClipboardList,
  more: LayoutGrid,
} satisfies Record<string, LucideIcon>;
export type IconName = keyof typeof ICONS;

export type NavItem = {
  href: string;
  label: string;
  icon?: IconName;
  exact?: boolean;
  badge?: number;
  /** Shown in the mobile tab bar (at most 3; the rest go under "Plus"). */
  tab?: boolean;
  /** Sidebar group heading. */
  group?: string;
  testId?: string;
};

function isActive(pathname: string, item: NavItem) {
  const clean = item.href.split("?")[0];
  return item.exact ? pathname === clean : pathname === clean || pathname.startsWith(`${clean}/`);
}

function Count({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="min-w-5 rounded-full bg-coral px-1.5 py-0.5 text-center text-[11px] font-bold leading-4 text-ink">{n > 99 ? "99+" : n}</span>
  );
}

/** Desktop sidebar, grouped, with icons. */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const groups: { name?: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return (
    <nav className="space-y-5">
      {groups.map((g, i) => (
        <div key={g.name ?? i}>
          {g.name && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.name}</p>}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.icon ?? "home"];
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    data-testid={item.testId}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                      active ? "bg-brand-soft font-semibold text-brand-dark" : "text-ink-soft hover:bg-surface hover:text-ink",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    <Count n={item.badge} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Mobile tab bar: the main destinations, plus a "Plus" sheet with everything else.
 * Hidden from `md` up, where the sidebar or the header takes over.
 */
export function TabBar({ items, moreLabel }: { items: NavItem[]; moreLabel?: string }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [more, setMore] = useState(false);
  const tabs = items.filter((i) => i.tab);
  const rest = items.filter((i) => !i.tab);
  const restActive = rest.some((i) => isActive(pathname, i));
  const restBadge = rest.reduce((n, i) => n + (i.badge ?? 0), 0);

  const cell = (active: boolean) =>
    clsx(
      "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition",
      active ? "text-brand-dark" : "text-muted",
    );

  return (
    <>
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
        aria-label={t("nav.menu")}
      >
        <ul className="mx-auto flex max-w-lg">
          {tabs.map((item) => {
            const Icon = ICONS[item.icon ?? "home"];
            const active = isActive(pathname, item);
            return (
              <li key={item.href} className="flex flex-1">
                <Link href={item.href} className={cell(active)} aria-current={active ? "page" : undefined} data-testid={item.testId}>
                  <span className={clsx("flex h-7 w-12 items-center justify-center rounded-full transition", active && "bg-brand-soft")}>
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                  </span>
                  {item.label}
                  {item.badge ? (
                    <span className="absolute start-1/2 top-1 ms-2">
                      <Count n={item.badge} />
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
          {rest.length > 0 && (
            <li className="flex flex-1">
              <button type="button" onClick={() => setMore(true)} className={cell(restActive)} data-testid="tab-more">
                <span className={clsx("flex h-7 w-12 items-center justify-center rounded-full", restActive && "bg-brand-soft")}>
                  <LayoutGrid className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                </span>
                {moreLabel ?? t("nav.more")}
                {restBadge ? (
                  <span className="absolute start-1/2 top-1 ms-2">
                    <Count n={restBadge} />
                  </span>
                ) : null}
              </button>
            </li>
          )}
        </ul>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title={moreLabel ?? t("nav.more")}>
        <ul className="grid grid-cols-2 gap-2" onClick={(e) => (e.target as HTMLElement).closest("a") && setMore(false)}>
          {rest.map((item) => {
            const Icon = ICONS[item.icon ?? "home"];
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-testid={item.testId}
                  className={clsx(
                    "flex min-h-20 flex-col justify-between gap-2 rounded-2xl border p-3 text-sm font-semibold transition",
                    active ? "border-brand bg-brand-soft text-brand-dark" : "border-line text-ink hover:bg-surface",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                    <Count n={item.badge} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
