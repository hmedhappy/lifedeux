"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Check, Globe } from "lucide-react";
import { locales } from "@/lib/i18n";
import { useI18n } from "./i18n-provider";
import { Dropdown } from "./menu";

const labels = { fr: "Français", en: "English", ar: "العربية" } as const;

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const rest = pathname.split("/").slice(2).join("/");

  return (
    <Dropdown
      label={t("common.language")}
      width="w-48"
      trigger={
        <span className="flex items-center gap-1.5 px-3 text-sm font-semibold text-ink">
          <Globe className="h-4 w-4" aria-hidden />
          <span className="uppercase">{locale}</span>
        </span>
      }
    >
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest ? `/${rest}` : ""}${search ? `?${search}` : ""}`}
          className={clsx("flex min-h-11 items-center justify-between px-4 py-2 text-sm hover:bg-surface", l === locale && "font-semibold")}
          hrefLang={l}
        >
          {labels[l]}
          {l === locale && <Check className="h-4 w-4 text-brand" aria-hidden />}
        </Link>
      ))}
    </Dropdown>
  );
}
