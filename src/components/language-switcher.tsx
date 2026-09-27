"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { locales } from "@/lib/i18n";
import { useI18n } from "./i18n-provider";

const labels = { fr: "Français", en: "English", ar: "العربية" } as const;

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const rest = pathname.split("/").slice(2).join("/");

  return (
    <details className="relative">
      <summary
        aria-label={t("common.language")}
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink hover:bg-surface [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
        </svg>
        <span className="uppercase">{locale}</span>
      </summary>
      <div className="absolute end-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-white py-2 shadow-float">
        {locales.map((l) => (
          <Link
            key={l}
            href={`/${l}${rest ? `/${rest}` : ""}${search ? `?${search}` : ""}`}
            className={clsx("block px-4 py-2 text-sm hover:bg-surface", l === locale && "font-semibold")}
            hrefLang={l}
          >
            {labels[l]}
          </Link>
        ))}
      </div>
    </details>
  );
}
