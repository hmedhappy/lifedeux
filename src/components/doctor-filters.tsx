"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Building2, Clock, Loader2, LocateFixed, MessageCircle, Star } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { useToast } from "./toast";

type Params = Record<string, string | undefined>;

/**
 * Sort (soonest, best rated, nearest) and kind of visit (practice, online), as chips that
 * scroll sideways on phones. "Près de moi" asks for the position, rounded to about 1 km.
 */
export function DoctorFilters({ base, params, idle = false }: { base: string; params: Params; /** Nothing listed yet: no chip shows as selected. */ idle?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const sort = idle ? null : (params.sort ?? "soon");

  const href = (change: Params) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...change })) if (v !== undefined && v !== "") next.set(k, v);
    if (!next.has("q") && !next.has("specialty") && !next.has("operation") && !next.has("service")) next.set("q", "");
    return `${base}?${next.toString()}`;
  };

  function nearMe() {
    if (!navigator.geolocation) return toast(t("filters.noLocation"), { tone: "error" });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const round = (v: number) => v.toFixed(2);
        router.push(href({ sort: "near", lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) }), { scroll: false });
      },
      () => {
        setLocating(false);
        toast(t("filters.noLocation"), { tone: "error" });
      },
      { timeout: 10000 },
    );
  }

  const chip = (on: boolean) =>
    clsx(
      "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition",
      on ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft hover:border-brand",
    );

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="toolbar" aria-label={t("filters.label")} data-testid="doctor-filters">
      <Link href={href({ sort: undefined, lat: undefined, lng: undefined })} scroll={false} className={chip(sort === "soon")} aria-pressed={sort === "soon"}>
        <Clock className="h-4 w-4" aria-hidden />
        {t("filters.soon")}
      </Link>
      <Link href={href({ sort: "rating", lat: undefined, lng: undefined })} scroll={false} className={chip(sort === "rating")} aria-pressed={sort === "rating"} data-testid="filter-rating">
        <Star className="h-4 w-4" aria-hidden />
        {t("filters.rating")}
      </Link>
      <button type="button" onClick={nearMe} className={chip(sort === "near")} aria-pressed={sort === "near"} data-testid="filter-near">
        {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LocateFixed className="h-4 w-4" aria-hidden />}
        {t("filters.near")}
      </button>
      <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden />
      <Link href={href({ mode: params.mode === "cabinet" ? undefined : "cabinet" })} scroll={false} className={chip(params.mode === "cabinet")} aria-pressed={params.mode === "cabinet"} data-testid="filter-cabinet">
        <Building2 className="h-4 w-4" aria-hidden />
        {t("cabinet.tag")}
      </Link>
      <Link href={href({ mode: params.mode === "online" ? undefined : "online" })} scroll={false} className={chip(params.mode === "online")} aria-pressed={params.mode === "online"} data-testid="filter-online">
        <MessageCircle className="h-4 w-4" aria-hidden />
        {t("doctor.service.consultation")}
      </Link>
    </div>
  );
}
