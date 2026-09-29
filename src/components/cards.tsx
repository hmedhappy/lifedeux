import Link from "next/link";
import type { Accommodation, Doctor, User } from "@prisma/client";
import { formatMoney } from "@/lib/format";
import type { Locale, TFunction } from "@/lib/i18n";
import { Avatar } from "./ui";
import { Photo } from "./photo";
import { Scissors, Video } from "lucide-react";
import { SpecialtyIcon } from "./specialty-icon";

export function DoctorCard({
  doctor,
  locale,
  t,
  fromPrice,
  consultationPrice,
  specialty,
  currency,
  nextSlot,
}: {
  doctor: Doctor & { user: Pick<User, "firstName" | "lastName"> };
  locale: Locale;
  t: TFunction;
  fromPrice: number | null;
  consultationPrice?: number | null;
  specialty?: { name: string; icon: string } | null;
  currency: string;
  nextSlot?: string | null;
}) {
  const name = `Dr ${doctor.user.firstName} ${doctor.user.lastName}`;
  return (
    <Link
      href={`/${locale}/doctors/${doctor.id}`}
      className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-float motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      data-testid="doctor-card"
    >
      <div className="flex items-start gap-4">
        <Avatar name={`${doctor.user.firstName} ${doctor.user.lastName}`} src={doctor.photoUrl} size={64} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink group-hover:underline">{name}</p>
          {specialty && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-brand-dark">
              <SpecialtyIcon name={specialty.icon} className="h-4 w-4" />
              {specialty.name}
            </p>
          )}
          <p className="mt-0.5 text-sm text-muted">
            {doctor.clinicName} · {doctor.city}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {consultationPrice != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
            <Video className="h-3.5 w-3.5" aria-hidden />
            {t("doctors.online")}
          </span>
        )}
        {fromPrice !== null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 font-medium text-brand-dark">
            <Scissors className="h-3.5 w-3.5" aria-hidden />
            {t("doctors.surgery")}
          </span>
        )}
        <span className="rounded-full bg-surface px-2.5 py-1 text-ink">{t("doctors.experience", { n: doctor.yearsOfExperience })}</span>
        {doctor.languages.slice(0, 3).map((lang) => (
          <span key={lang} className="rounded-full bg-surface px-2.5 py-1 text-ink">
            {lang}
          </span>
        ))}
      </div>
      <div className="mt-auto pt-4">
      <div className="flex items-end justify-between gap-3 border-t border-line pt-4">
        <div className="text-sm text-muted">{nextSlot ? t("doctors.nextSlot", { date: nextSlot }) : t("doctors.noSlotSoon")}</div>
        <div className="text-end">
          {consultationPrice != null ? (
            <>
              <span className="block text-xs text-muted">{t("doctors.consultFrom")}</span>
              <span className="font-semibold text-ink">{formatMoney(consultationPrice, currency, locale)}</span>
            </>
          ) : fromPrice !== null ? (
            <>
              <span className="block text-xs text-muted">{t("doctors.from")}</span>
              <span className="font-semibold text-ink">{formatMoney(fromPrice, currency, locale)}</span>
            </>
          ) : null}
        </div>
      </div>
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
