import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { BadgeCheck, Clock3, Languages, MapPin, MessageCircle, Scissors, Star } from "lucide-react";
import { BookingBar } from "@/components/booking-bar";
import { BookingPanel } from "@/components/booking-panel";
import { SpecialtyIcon } from "@/components/specialty-icon";
import { Avatar, Badge, Container, Disclosure } from "@/components/ui";
import { requestBookingAction } from "@/actions/patient";
import { requestConsultationAction } from "@/actions/consultation";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { toSlotOptions } from "@/lib/slot-options";
import { googleEnabled } from "@/lib/google-auth";
import { getT, localized, toLocale } from "@/lib/i18n";
import { getPublicDoctor } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { specialtyTint } from "@/lib/specialty-tint";

type Service = "consultation" | "operation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const doctor = await getPublicDoctor(id);
  return { title: doctor ? `Dr ${doctor.user.firstName} ${doctor.user.lastName}` : undefined };
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={clsx("h-4 w-4", i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-line-strong")} aria-hidden />
      ))}
    </span>
  );
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
  const slots = toSlotOptions(service === "consultation" ? doctor.consultationSlots : doctor.operationSlots, locale);
  const price = service === "consultation" ? money(doctor.consultation!.price) : money(minPrice);
  const next = `/${locale}/doctors/${doctor.id}${service ? `?service=${service}` : ""}`;
  const action = service === "consultation" ? requestConsultationAction.bind(null, locale, doctor.id) : requestBookingAction.bind(null, locale, doctor.id);

  const panel = service ? (
    <BookingPanel
      key={service}
      service={service}
      slots={slots}
      action={action}
      signedIn={!!user}
      isPatient={user?.role === "PATIENT"}
      googleEnabled={googleEnabled()}
      operations={offers.map((o) => ({ id: o.operationId, label: `${localized(o.operation, "name", locale)} — ${money(o.price)}` }))}
      needsContact={service === "operation" && (!user?.phone || !user?.country)}
      next={next}
    />
  ) : (
    <p className="text-sm text-muted">{t("doctor.noService")}</p>
  );

  const tabs =
    services.length > 1 ? (
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1" role="tablist" aria-label={t("doctor.chooseService")}>
        {services.map((s) => (
          <Link
            key={s}
            href={`/${locale}/doctors/${doctor.id}?service=${s}`}
            role="tab"
            aria-selected={s === service}
            scroll={false}
            className={clsx(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition",
              s === service ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            {s === "consultation" ? <MessageCircle className="h-4 w-4" aria-hidden /> : <Scissors className="h-4 w-4" aria-hidden />}
            {t(`doctor.service.${s}`)}
          </Link>
        ))}
      </div>
    ) : null;

  return (
    <Container className="py-6 sm:py-10">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={name} src={doctor.photoUrl} size={96} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {doctor.specialty_ && (
              <Link
                href={`/${locale}/doctors?specialty=${doctor.specialty_.slug}`}
                className={clsx("inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold", specialtyTint(doctor.specialty_.slug))}
              >
                <SpecialtyIcon name={doctor.specialty_.icon} className="h-4 w-4" />
                {specialtyName}
              </Link>
            )}
            <Badge tone="brand">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              {t("doctor.verified")}
            </Badge>
            {doctor.rating && (
              <a href="#reviews" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
                <Stars value={doctor.rating.average} />
                <span className="font-semibold text-ink">{doctor.rating.average.toFixed(1)}</span>
                <span>({t("doctor.reviewsCount", { n: doctor.rating.count })})</span>
              </a>
            )}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span>{doctor.specialty}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" aria-hidden />
              {doctor.clinicName}, {doctor.city}
            </span>
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_420px]">
        <div className="min-w-0 space-y-8">
          {tabs && <div className="lg:hidden">{tabs}</div>}

          <ul className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: Clock3, label: t("doctors.experience", { n: doctor.yearsOfExperience }) },
              { icon: Languages, label: doctor.languages.join(", ") || "—" },
              service === "consultation"
                ? { icon: MessageCircle, label: t("doctor.consultLabel", { n: doctor.consultationMinutes }) }
                : { icon: Scissors, label: t("doctor.surgeryFrom", { price: money(minPrice) }) },
            ].map((f, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm text-ink shadow-card">
                <f.icon className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                {f.label}
              </li>
            ))}
          </ul>

          {service === "consultation" && (
            <section className="rounded-2xl bg-brand-soft/60 p-5">
              <h2 className="font-semibold text-ink">{t("doctor.consultTitle")}</h2>
              <p className="mt-1 text-sm text-ink-soft">{t("doctor.consultText")}</p>
            </section>
          )}

          {service === "operation" && offers.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-ink">{t("doctor.operations")}</h2>
              <ul className="mt-3 space-y-3">
                {offers.map((o) => (
                  <li key={o.operationId} className="rounded-2xl border border-line bg-white p-5 shadow-card">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-ink">{localized(o.operation, "name", locale)}</p>
                      <p className="font-bold text-ink">{money(o.price)}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted">{t("doctor.recovery", { n: o.operation.defaultRecoveryNights })}</p>
                    <Disclosure summary={t("doctor.details")} className="mt-2">
                      <p className="text-sm text-ink-soft">{localized(o.operation, "description", locale)}</p>
                    </Disclosure>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-2xl bg-trip-soft p-5">
                <h3 className="font-semibold text-ink">{t("doctor.includedTitle")}</h3>
                <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {["transfer", "stay", "tracking", "support"].map((k) => (
                    <li key={k} className="flex gap-2">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-trip" aria-hidden />
                      <span className="text-ink-soft">{t(`doctor.included.${k}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section id="reviews" className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-ink">{t("doctor.reviewsTitle")}</h2>
            {doctor.reviews.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t("doctor.noReviews")}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {doctor.reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-line bg-white p-4" data-testid="review">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Stars value={r.rating} />
                      <span className="text-xs text-muted">
                        {r.author} · {formatDate(r.createdAt, locale)}
                      </span>
                    </div>
                    {r.text && <p className="mt-2 text-sm text-ink-soft">{r.text}</p>}
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
                      <BadgeCheck className="h-3.5 w-3.5 text-brand" aria-hidden />
                      {t("doctor.verifiedReview")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Disclosure summary={t("doctor.about")} className="rounded-2xl border border-line bg-white px-5 py-2">
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{doctor.bio}</p>
            <p className="mt-3 text-sm text-muted">
              {t("doctor.clinic")} : {doctor.clinicAddress}, {doctor.city}
            </p>
          </Disclosure>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5 rounded-3xl border border-line bg-white p-6 shadow-float">
            {tabs}
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted">{service === "consultation" ? t("doctor.consultPrice") : t("doctors.from")}</p>
              <p className="text-2xl font-bold text-ink">{price}</p>
            </div>
            {panel}
          </div>
        </aside>
      </div>

      {/* Doctors, admins and agents cannot book: no "choose a slot" bar for them. */}
      {service && (!user || user.role === "PATIENT") && (
        <BookingBar
          price={price}
          nextSlot={slots[0] ? slots[0].full : null}
          label={service === "consultation" ? t("doctor.chooseSlotCta") : t("doctor.chooseSlotSurgery")}
          title={service === "consultation" ? t("doctor.consultTitle") : t("doctor.service.operation")}
        >
          {panel}
        </BookingBar>
      )}
    </Container>
  );
}
