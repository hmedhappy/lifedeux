import Link from "next/link";
import type { Accommodation, Doctor, User } from "@prisma/client";
import { formatMoney } from "@/lib/format";
import type { Locale, TFunction } from "@/lib/i18n";
import { Avatar } from "./ui";
import { Photo } from "./photo";
import { Scissors, Star, Video } from "lucide-react";
import { specialtyTint } from "@/lib/specialty-tint";
import { SpecialtyIcon } from "./specialty-icon";

/** Compact doctor card: who, what, how soon, how much. Languages and details stay on the profile. */
export function DoctorCard({
  doctor,
  locale,
  t,
  fromPrice,
  consultationPrice,
  specialty,
  currency,
  nextSlot,
  rating,
  service,
}: {
  doctor: Doctor & { user: Pick<User, "firstName" | "lastName"> };
  locale: Locale;
  t: TFunction;
  fromPrice: number | null;
  consultationPrice?: number | null;
  specialty?: { name: string; icon: string; slug?: string } | null;
  currency: string;
  nextSlot?: string | null;
  rating?: { average: number; count: number } | null;
  /** Opens the profile on this tab (e.g. "operation" from the surgery list). */
  service?: "consultation" | "operation";
}) {
  const name = `Dr ${doctor.user.firstName} ${doctor.user.lastName}`;
  const showSurgery = service === "operation" || consultationPrice == null;
  const price = showSurgery ? fromPrice : consultationPrice;
  return (
    <Link
      href={`/${locale}/doctors/${doctor.id}${service ? `?service=${service}` : ""}`}
      className="group flex h-full flex-col rounded-2xl border border-line bg-white p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float sm:p-5"
      data-testid="doctor-card"
    >
      <div className="flex items-start gap-3.5">
        <Avatar name={name} src={doctor.photoUrl} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{name}</p>
          {specialty && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-ink-soft">
              <span className={`flex h-5 w-5 items-center justify-center rounded-md ${specialtyTint(specialty.slug)}`}>
                <SpecialtyIcon name={specialty.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="truncate">{specialty.name}</span>
            </p>
          )}
          <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
            <span className="truncate">{doctor.city}</span>
            {rating && (
              <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-ink">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                {rating.average.toFixed(1)}
                <span className="font-normal text-muted">({rating.count})</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {consultationPrice != null && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-brand" title={t("doctors.online")}>
              <Video className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">{t("doctors.online")}</span>
            </span>
          )}
          {fromPrice !== null && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-trip-soft text-trip" title={t("doctors.surgery")}>
              <Scissors className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">{t("doctors.surgery")}</span>
            </span>
          )}
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold ${nextSlot ? "bg-emerald-50 text-emerald-800" : "bg-surface text-muted"}`}>
          {nextSlot ? t("doctors.nextSlot", { date: nextSlot }) : t("doctors.noSlotSoon")}
        </span>
        {price != null && (
          <span className="text-end text-sm">
            <span className="text-muted">{showSurgery ? t("doctors.from") : t("doctors.consultFrom")} </span>
            <span className="font-bold text-ink">{formatMoney(price, currency, locale)}</span>
          </span>
        )}
      </div>
    </Link>
  );
}

export function StayCard({
  stay,
  locale,
  t,
  currency,
  footer,
}: {
  stay: Accommodation;
  locale: Locale;
  t: TFunction;
  currency: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="group" data-testid="stay-card">
      <Photo src={stay.photos[0]} alt={stay.title} className="aspect-square w-full rounded-2xl" />
      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="font-semibold text-ink">{stay.title}</p>
        <span className="shrink-0 text-sm text-ink">{t(`accType.${stay.type}`)}</span>
      </div>
      <p className="text-sm text-muted">
        {stay.city} · {t("stays.guests", { n: stay.capacity })} · {t("stays.bedrooms", { n: stay.bedrooms })}
      </p>
      <p className="mt-1 text-sm text-ink">
        <span className="font-semibold">{formatMoney(stay.pricePerNight, currency, locale)}</span> {t("stays.perNight")}
      </p>
      {footer}
    </div>
  );
}
