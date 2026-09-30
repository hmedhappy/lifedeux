import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { MessageCircle, Scissors } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { SlotPicker, type SlotOption } from "@/components/slot-picker";
import { SpecialtyIcon } from "@/components/specialty-icon";
import { Avatar, Container, Field, LinkButton, Notice, Select, Textarea } from "@/components/ui";
import { requestBookingAction } from "@/actions/patient";
import { requestConsultationAction } from "@/actions/consultation";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney, formatTime, tunisDayKey } from "@/lib/format";
import { getT, localized, toLocale, type Locale } from "@/lib/i18n";
import { getPublicDoctor } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

type Service = "consultation" | "operation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const doctor = await getPublicDoctor(id);
  return { title: doctor ? `Dr ${doctor.user.firstName} ${doctor.user.lastName}` : undefined };
}

function toOptions(slots: { id: string; startsAt: Date }[], locale: Locale): SlotOption[] {
  return slots.map((s) => ({
    id: s.id,
    dayKey: tunisDayKey(s.startsAt),
    dayLabel: formatDate(s.startsAt, locale, { day: "numeric", month: "short", year: undefined }),
    weekday: formatDate(s.startsAt, locale, { weekday: "short", day: undefined, month: undefined, year: undefined }),
    time: formatTime(s.startsAt, locale),
    full: formatDateTime(s.startsAt, locale),
  }));
}

export default async function DoctorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { locale: raw, id } = await params;
  const { service: requested } = await searchParams;
  const locale = toLocale(raw);
  const t = getT(locale);
  const [doctor, settings, user] = await Promise.all([getPublicDoctor(id), getSettings(), getCurrentUser()]);
  if (!doctor) notFound();

  const name = `Dr ${doctor.user.firstName} ${doctor.user.lastName}`;
  const offers = doctor.operations;
  const services: Service[] = [...(doctor.consultation ? (["consultation"] as const) : []), ...(offers.length ? (["operation"] as const) : [])];
  const service: Service | undefined = services.includes(requested as Service) ? (requested as Service) : services[0];
  const money = (v: number) => formatMoney(v, settings.currency, locale);
  const minPrice = offers.length ? Math.min(...offers.map((o) => o.price)) : 0;
  const specialtyName = doctor.specialty_ ? localized(doctor.specialty_, "name", locale) : doctor.specialty;
  const loginHref = `/${locale}/login?next=/${locale}/doctors/${doctor.id}${service ? `?service=${service}` : ""}`;

  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={`${doctor.user.firstName} ${doctor.user.lastName}`} src={doctor.photoUrl} size={88} />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
            {doctor.specialty_ && (
              <Link
                href={`/${locale}/doctors?specialty=${doctor.specialty_.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-dark hover:underline"
              >
                <SpecialtyIcon name={doctor.specialty_.icon} className="h-4 w-4" />
                {specialtyName}
              </Link>
            )}
            <span>
              {doctor.specialty} · {doctor.clinicName}, {doctor.city}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_400px]">
        <div className="space-y-10">
          <section className="grid gap-4 border-b border-line pb-10 sm:grid-cols-3">
            {[
              { title: t("doctor.experience"), text: t("doctors.experience", { n: doctor.yearsOfExperience }) },
              { title: t("doctor.languages"), text: doctor.languages.join(", ") },
              { title: t("doctor.clinic"), text: doctor.clinicAddress },
            ].map((item) => (
              <div key={item.title}>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-sm text-muted">{item.text}</p>
              </div>
            ))}
          </section>

          <section className="border-b border-line pb-10">
            <h2 className="text-xl font-semibold text-ink">{t("doctor.about")}</h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-ink/90">{doctor.bio}</p>
          </section>

          {doctor.consultation && (
            <section className="border-b border-line pb-10">
              <h2 className="text-xl font-semibold text-ink">{t("doctor.consultTitle")}</h2>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <MessageCircle className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{t("doctor.consultLabel", { n: doctor.consultationMinutes })}</p>
                    <p className="mt-1 text-sm text-muted">{t("doctor.consultText")}</p>
                  </div>
                </div>
                <p className="font-semibold text-ink">{money(doctor.consultation.price)}</p>
              </div>
            </section>
          )}

          {offers.length > 0 && (
            <section className="border-b border-line pb-10">
              <h2 className="text-xl font-semibold text-ink">{t("doctor.operations")}</h2>
              <ul className="mt-4 space-y-4">
                {offers.map((o) => (
                  <li key={o.operationId} className="rounded-2xl border border-line p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-ink">{localized(o.operation, "name", locale)}</p>
                      <p className="font-semibold text-ink">{money(o.price)}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted">{localized(o.operation, "description", locale)}</p>
                    <p className="mt-2 text-xs text-muted">{t("doctor.recovery", { n: o.operation.defaultRecoveryNights })}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {offers.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-ink">{t("doctor.includedTitle")}</h2>
              <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {["transfer", "stay", "tracking", "support"].map((k) => (
                  <li key={k} className="flex gap-3">
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-ink/90">{t(`doctor.included.${k}`)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside>
          <div className="sticky top-28 rounded-2xl border border-line bg-white p-6 shadow-float">
            {services.length > 1 && (
              <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1" role="tablist" aria-label={t("doctor.chooseService")}>
                {services.map((s) => (
                  <Link
                    key={s}
                    href={`/${locale}/doctors/${doctor.id}?service=${s}`}
                    role="tab"
                    aria-selected={s === service}
                    scroll={false}
                    className={clsx(
                      "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition",
                      s === service ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
                    )}
                  >
                    {s === "consultation" ? <MessageCircle className="h-4 w-4" aria-hidden /> : <Scissors className="h-4 w-4" aria-hidden />}
                    {t(`doctor.service.${s}`)}
                  </Link>
                ))}
              </div>
            )}

            {!service ? (
              <p className="text-sm text-muted">{t("doctor.noService")}</p>
            ) : (
              <>
                <p className="text-sm text-muted">{service === "consultation" ? t("doctor.consultPrice") : t("doctors.from")}</p>
                <p className="text-2xl font-semibold text-ink">
                  {money(service === "consultation" ? doctor.consultation!.price : minPrice)}
                </p>

                {user && user.role !== "PATIENT" ? (
                  <div className="mt-6">
                    <Notice tone="info">{t("doctor.patientsOnly")}</Notice>
                  </div>
                ) : !user ? (
                  <div className="mt-6 space-y-4">
                    <SlotPreview
                      slots={toOptions(service === "consultation" ? doctor.consultationSlots : doctor.operationSlots, locale)}
                      emptyText={t("doctor.noSlots")}
                    />
                    <LinkButton href={loginHref} size="lg" className="w-full">
                      {t("doctor.loginToBook")}
                    </LinkButton>
                    <p className="text-center text-xs text-muted">{t("doctor.noChargeYet")}</p>
                  </div>
                ) : service === "consultation" ? (
                  <ActionForm action={requestConsultationAction.bind(null, locale, doctor.id)} className="mt-6 space-y-5" key="consultation">
                    <div>
                      <p className="mb-3 text-sm font-medium text-ink">{t("doctor.chooseSlot")}</p>
                      <SlotPicker slots={toOptions(doctor.consultationSlots, locale)} />
                    </div>
                    <Field label={t("doctor.reason")} hint={t("doctor.reasonHint")}>
                      <Textarea name="reason" maxLength={1000} rows={3} />
                    </Field>
                    <SubmitButton size="lg" className="w-full">
                      {t("doctor.requestConsult")}
                    </SubmitButton>
                    <p className="text-center text-xs text-muted">{t("doctor.noChargeYet")}</p>
                  </ActionForm>
                ) : (
                  <ActionForm action={requestBookingAction.bind(null, locale, doctor.id)} className="mt-6 space-y-5" key="operation">
                    {offers.length > 1 ? (
                      <Field label={t("doctor.operation")}>
                        <Select name="operationId" required>
                          {offers.map((o) => (
                            <option key={o.operationId} value={o.operationId}>
                              {localized(o.operation, "name", locale)} — {money(o.price)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    ) : (
                      <input type="hidden" name="operationId" value={offers[0]?.operationId ?? ""} />
                    )}
                    <div>
                      <p className="mb-3 text-sm font-medium text-ink">{t("doctor.chooseSlot")}</p>
                      <SlotPicker slots={toOptions(doctor.operationSlots, locale)} />
                    </div>
                    <Field label={t("doctor.note")} hint={t("doctor.noteHint")}>
                      <Textarea name="note" maxLength={1000} rows={3} />
                    </Field>
                    <SubmitButton size="lg" className="w-full">
                      {t("doctor.requestButton")}
                    </SubmitButton>
                    <p className="text-center text-xs text-muted">{t("doctor.noChargeYet")}</p>
                  </ActionForm>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </Container>
  );
}

function SlotPreview({ slots, emptyText }: { slots: SlotOption[]; emptyText: string }) {
  if (slots.length === 0) return <p className="rounded-xl bg-surface p-4 text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="space-y-2 text-sm">
      {slots.slice(0, 4).map((s) => (
        <li key={s.id} className="rounded-lg border border-line px-3 py-2 text-ink">
          {s.full}
        </li>
      ))}
    </ul>
  );
}
