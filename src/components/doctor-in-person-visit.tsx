import Link from "next/link";
import { ArrowLeft, Banknote, CalendarDays, Check, Mail, Phone, UserX } from "lucide-react";
import { ActionForm, SubmitButton } from "./forms";
import { CabinetTag, StatusBadge } from "./status";
import { Avatar, Disclosure, Input } from "./ui";
import { closeInPersonAction, confirmConsultationAction, refuseConsultationAction } from "@/actions/consultation";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Locale, TFunction } from "@/lib/i18n";
import type { ConsultationStatus } from "@prisma/client";

type Visit = {
  id: string;
  reference: string;
  status: ConsultationStatus;
  price: number;
  currency: string;
  reason: string | null;
  slot: { startsAt: Date };
  patient: { firstName: string; lastName: string; email: string; phone: string | null };
};

/** Doctor's view of an appointment at the practice: who, when, and what happened. */
export function DoctorInPersonVisit({ c, locale, t }: { c: Visit; locale: Locale; t: TFunction }) {
  const name = `${c.patient.firstName} ${c.patient.lastName}`;
  const started = c.slot.startsAt <= new Date();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/${locale}/doctor/consultations`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        {t("doctorArea.consultationsTitle")}
      </Link>

      <section className="mt-3 overflow-hidden rounded-3xl border border-line bg-white shadow-card" data-testid="doctor-in-person">
        <header className="flex items-center gap-4 p-5">
          <Avatar name={name} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight text-ink">{name}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <CabinetTag t={t} />
              <StatusBadge status={c.status} t={t} mode="IN_PERSON" />
            </p>
            <p className="mt-1 text-xs text-muted">{c.reference}</p>
          </div>
        </header>
        <ul className="divide-y divide-line border-t border-line text-sm">
          <li className="flex items-center gap-3 px-5 py-4">
            <CalendarDays className="h-5 w-5 shrink-0 text-brand" aria-hidden />
            <span className="font-semibold text-ink first-letter:uppercase">{formatDateTime(c.slot.startsAt, locale)}</span>
          </li>
          <li className="flex items-center gap-3 px-5 py-4">
            <Banknote className="h-5 w-5 shrink-0 text-brand" aria-hidden />
            <span className="text-ink">
              {formatMoney(c.price, c.currency, locale)} <span className="text-muted">· {t("cabinet.paidAtPractice")}</span>
            </span>
          </li>
          {c.patient.phone && (
            <li>
              <a href={`tel:${c.patient.phone}`} className="flex min-h-11 items-center gap-3 px-5 py-4 text-ink hover:bg-surface">
                <Phone className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                <span dir="ltr">{c.patient.phone}</span>
              </a>
            </li>
          )}
          <li>
            <a href={`mailto:${c.patient.email}`} className="flex min-h-11 items-center gap-3 px-5 py-4 text-ink hover:bg-surface">
              <Mail className="h-5 w-5 shrink-0 text-brand" aria-hidden />
              <span className="truncate">{c.patient.email}</span>
            </a>
          </li>
          {c.reason && (
            <li className="px-5 py-4">
              <p className="text-xs font-semibold text-muted">{t("consult.reason")}</p>
              <p className="mt-0.5 text-ink">{c.reason}</p>
            </li>
          )}
        </ul>
      </section>

      {c.status === "REQUESTED" && (
        <div className="mt-5 space-y-3">
          <form action={confirmConsultationAction.bind(null, locale, c.id)}>
            <SubmitButton size="lg" className="w-full" testId="in-person-confirm">
              <Check className="h-4 w-4" aria-hidden />
              {t("cabinet.confirm")}
            </SubmitButton>
          </form>
          <Disclosure summary={t("doctorArea.refuse")}>
            <ActionForm action={refuseConsultationAction.bind(null, locale, c.id)} className="flex gap-2">
              <Input name="reason" required placeholder={t("cabinet.refusePlaceholder")} aria-label={t("doctorArea.refuse")} />
              <SubmitButton variant="danger">{t("doctorArea.refuse")}</SubmitButton>
            </ActionForm>
          </Disclosure>
        </div>
      )}

      {c.status === "CONFIRMED" && started && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <form action={closeInPersonAction.bind(null, locale, c.id, "COMPLETED")}>
            <SubmitButton size="lg" className="w-full" testId="in-person-came">
              <Check className="h-4 w-4" aria-hidden />
              {t("cabinet.came")}
            </SubmitButton>
          </form>
          <form action={closeInPersonAction.bind(null, locale, c.id, "NO_SHOW")}>
            <SubmitButton size="lg" variant="secondary" className="w-full" testId="in-person-noshow">
              <UserX className="h-4 w-4" aria-hidden />
              {t("cabinet.noShow")}
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
