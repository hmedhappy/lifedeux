"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { normalizeSearch } from "@/lib/search-text";
import { useI18n } from "./i18n-provider";
import { SpecialtyIcon } from "./specialty-icon";

export type SpecialtyTile = { slug: string; name: string; names: string[]; icon: string; count: number };

/** Soft, distinct tints so neighbouring cards do not look identical. */
const TINTS = [
  "from-rose-50 to-rose-100 text-rose-600",
  "from-sky-50 to-sky-100 text-sky-600",
  "from-emerald-50 to-emerald-100 text-emerald-600",
  "from-amber-50 to-amber-100 text-amber-600",
  "from-violet-50 to-violet-100 text-violet-600",
  "from-teal-50 to-teal-100 text-teal-600",
  "from-orange-50 to-orange-100 text-orange-600",
  "from-indigo-50 to-indigo-100 text-indigo-600",
];

export function SpecialtyBrowser({ specialties, initialQuery = "" }: { specialties: SpecialtyTile[]; initialQuery?: string }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const needle = normalizeSearch(query);
  const visible = useMemo(
    () => (needle ? specialties.filter((s) => s.names.some((n) => normalizeSearch(n).includes(needle))) : specialties),
    [needle, specialties],
  );

  return (
    <div>
      <form action={`/${locale}/doctors`} className="mx-auto flex max-w-2xl items-center gap-2 rounded-full border border-line bg-white p-2 ps-5 shadow-float" role="search">
        <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        <input
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("specialties.searchPlaceholder")}
          aria-label={t("specialties.searchPlaceholder")}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          data-testid="specialty-search"
        />
        <button type="submit" className="rounded-full bg-gradient-to-r from-brand to-brand-dark px-5 py-3 text-sm font-semibold text-white">
          {t("specialties.searchDoctors")}
        </button>
      </form>

      <p className="mt-8 text-sm text-muted" aria-live="polite">
        {t("specialties.count", { n: visible.length })}
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((s, i) => (
          <li key={s.slug}>
            <Link
              href={`/${locale}/doctors?specialty=${s.slug}`}
              data-testid="specialty-card"
              className="group flex h-full flex-col gap-4 rounded-2xl border border-line bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-transparent hover:shadow-float focus-visible:outline-2 focus-visible:outline-ink motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${TINTS[i % TINTS.length]} transition group-hover:scale-105 motion-reduce:transition-none`}>
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
