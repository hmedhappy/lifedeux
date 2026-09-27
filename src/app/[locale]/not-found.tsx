"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  const { t, locale } = useI18n();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-7xl font-bold text-brand">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-ink">{t("errors.notFoundTitle")}</h1>
      <p className="mt-2 text-muted">{t("errors.notFoundText")}</p>
      <Link href={`/${locale}`} className={buttonClass("primary", "lg", "mt-8")}>
        {t("errors.backHome")}
      </Link>
    </div>
  );
}
