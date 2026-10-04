import Link from "next/link";
import { ArrowLeft, Banknote, CalendarDays, MapPin, Navigation } from "lucide-react";
import { ConfirmSubmit } from "./forms";
import { StatusBadge } from "./status";
import { Avatar, Container, Notice } from "./ui";
import { cancelConsultationAction } from "@/actions/consultation";
import { mapsLink } from "@/lib/consultation-flow";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Locale, TFunction } from "@/lib/i18n";
import type { ConsultationStatus } from "@prisma/client";

type Visit = {
  id: string;
  reference: string;
  status: ConsultationStatus;
  price: number;
  currency: string;
  refusalReason: string | null;
  slot: { startsAt: Date };
  doctor: {
    photoUrl: string | null;
    clinicName: string;
    clinicAddress: string;
    city: string;
    clinicLat: number | null;
    clinicLng: number | null;
    user: { firstName: string; lastName: string };
  };
};

/** Patient's appointment at the practice: when, where, how much to pay there, and cancel. */
export function InPersonVisit({
  c,
  specialty,
  locale,
  t,
  requested,
  cancel,
}: {
  c: Visit;
  specialty: string;
  locale: Locale;
  t: TFunction;
  requested: boolean;
  cancel?: string;
}) {
  const doctorName = `Dr ${c.doctor.user.firstName} ${c.doctor.user.lastName}`;
  const address = [c.doctor.clinicName, c.doctor.clinicAddress, c.doctor.city].filter(Boolean).join(", ");
  const upcoming = c.slot.startsAt > new Date();
  const canCancel = upcoming && (c.status === "REQUESTED" || c.status === "CONFIRMED");

  return (
    <Container className="max-w-2xl py-6 sm:py-10">
      <Link href={`/${locale}/account`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        {t("account.title")}
      </Link>

      <div className="mt-3 space-y-3">
        {requested && c.status === "CONFIRMED" && <Notice tone="success">{t("cabinet.bookedNotice")}</Notice>}
        {requested && c.status === "REQUESTED" && <Notice tone="info">{t("cabinet.requestedNotice")}</Notice>}
        {cancel === "cancelled" && <Notice tone="success">{t("cabinet.cancelledNotice")}</Notice>}
        {c.status === "REFUSED" && <Notice tone="error">{t("cabinet.refusedNotice", { reason: c.refusalReason ?? "" })}</Notice>}
      </div>

      <section className="mt-4 overflow-hidden rounded-3xl border border-line bg-white shadow-card" data-testid="in-person-visit">
        <header className="flex items-center gap-4 p-5">
          <Avatar name={`${c.doctor.user.firstName} ${c.doctor.user.lastName}`} src={c.doctor.photoUrl} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight text-ink">{doctorName}</h1>
            <p className="text-sm text-muted">{specialty}</p>
            <p className="mt-1.5">
              <StatusBadge status={c.status} t={t} mode="IN_PERSON" />
            </p>
          </div>
        </header>
        <ul className="divide-y divide-line border-t border-line">
          <li className="flex items-start gap-3 p-5">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
            <div>
              <p className="font-semibold text-ink first-letter:uppercase">{formatDateTime(c.slot.startsAt, locale)}</p>
              <p className="text-sm text-muted">
                {t("booking.reference")} {c.reference}
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-5">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
            <div className="min-w-0">
              <p className="text-ink">{address}</p>
              <a
                href={mapsLink(c.doctor)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand hover:underline"
              >
                <Navigation className="h-4 w-4" aria-hidden />
                {t("cabinet.directions")}
              </a>
            </div>
          </li>
          <li className="flex items-start gap-3 p-5">
            <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
            <div>
              <p className="font-semibold text-ink">{formatMoney(c.price, c.currency, locale)}</p>
              <p className="text-sm text-muted">{t("cabinet.payThere")}</p>
            </div>
          </li>
        </ul>
      </section>

      {canCancel && (
        <form action={cancelConsultationAction.bind(null, locale, c.id)} className="mt-6">
          <ConfirmSubmit message={t("cabinet.cancelConfirm")} variant="danger" testId="consult-cancel">
            {t("cabinet.cancel")}
          </ConfirmSubmit>
        </form>
      )}
    </Container>
  );
}
