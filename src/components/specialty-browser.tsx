"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { normalizeSearch } from "@/lib/search-text";
import { specialtyTint } from "@/lib/specialty-tint";
import { specialtiesForSymptom } from "@/lib/symptoms";
import { useI18n } from "./i18n-provider";
import { SpecialtyIcon } from "./specialty-icon";

export type SpecialtyTile = { slug: string; name: string; names: string[]; icon: string; count: number };

export function SpecialtyBrowser({ specialties, initialQuery = "" }: { specialties: SpecialtyTile[]; initialQuery?: string }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const needle = normalizeSearch(query);
  // A symptom ("mal de dos") also brings up the specialties that treat it.
  const bySymptom = useMemo(() => new Set(specialtiesForSymptom(query)), [query]);
  const visible = useMemo(
    () => (needle ? specialties.filter((s) => bySymptom.has(s.slug) || s.names.some((n) => normalizeSearch(n).includes(needle))) : specialties),
    [needle, specialties, bySymptom],
  );

  return (
    <div>
      <form action={`/${locale}/doctors`} className="mx-auto flex max-w-2xl items-center gap-2 rounded-full border border-line-strong bg-white p-1.5 ps-4 shadow-float sm:ps-5" role="search">
        <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        <input
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("specialties.searchPlaceholder")}
          aria-label={t("specialties.searchPlaceholder")}
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink placeholder:text-muted focus:outline-none sm:text-sm"
          data-testid="specialty-search"
        />
        {/* Phones: a round arrow button, so the field keeps the width for typing. */}
        <button
          type="submit"
          aria-label={t("specialties.searchDoctors")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white hover:bg-brand-dark sm:w-auto sm:px-5"
        >
          <ArrowRight className="h-5 w-5 rtl:-scale-x-100 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">{t("specialties.searchDoctors")}</span>
        </button>
      </form>

      <p className="mt-8 text-sm text-muted" aria-live="polite">
        {t("specialties.count", { n: visible.length })}
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/${locale}/doctors?specialty=${s.slug}`}
              data-testid="specialty-card"
              className="group flex h-full flex-col gap-4 rounded-2xl border border-line bg-white p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${specialtyTint(s.slug)} transition group-hover:scale-105`}>
                <SpecialtyIcon name={s.icon} className="h-6 w-6" />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-semibold leading-snug text-ink">{s.name}</span>
                <span className="mt-1 text-xs text-muted">
                  {s.count > 0 ? t("specialties.doctors", { n: s.count }) : t("specialties.soon")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{t("specialties.none")}</p>
      )}
    </div>
  );
}
