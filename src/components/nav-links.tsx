"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export type NavItem = { href: string; label: string; exact?: boolean; badge?: number };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              active ? "bg-surface font-semibold text-ink" : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            {item.label}
            {item.badge ? (
              <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">{item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
