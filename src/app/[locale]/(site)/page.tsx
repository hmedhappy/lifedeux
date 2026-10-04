import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  FileSignature,
  Hotel,
  Languages,
  Lock,
  MessagesSquare,
  Plane,
  QrCode,
  Scissors,
  Search,
  Stethoscope,
  Video,
} from "lucide-react";
import { DoctorCard, StayCard } from "@/components/cards";
import { SpecialtyIcon } from "@/components/specialty-icon";
import { Container, LinkButton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { listActiveStays, listPublicDoctors, listSpecialties } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { specialtyTint } from "@/lib/specialty-tint";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const [specialties, doctors, stays, settings] = await Promise.all([listSpecialties(), listPublicDoctors(), listActiveStays(), getSettings()]);
  // Specialties with doctors first, so the grid never leads to an empty list.
  const popular = [...specialties].sort((a, b) => Number(b.doctorCount > 0) - Number(a.doctorCount > 0) || a.sortOrder - b.sortOrder).slice(0, 12);
  const featured = doctors.filter((d) => d.consultation).slice(0, 3);
  const consultSteps = [Search, CalendarCheck, MessagesSquare, FileSignature];
  const surgerySteps = [Scissors, CalendarCheck, CreditCard, Plane, QrCode];

  return (
    <>
      <section className="border-b border-line bg-white">
        <Container className="py-8 sm:py-14 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-dark">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              {t("home.badge")}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">{t("home.heroTitle")}</h1>
            <p className="mx-auto mt-4 hidden max-w-xl text-lg text-muted sm:block">{t("home.heroSubtitle")}</p>

            <form action={`/${locale}/doctors`} role="search" className="mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-full border border-line-strong bg-white p-1.5 ps-4 shadow-float sm:mt-8 sm:ps-5">
              <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
              <input
                name="q"
                placeholder={t("home.searchPlaceholder")}
                aria-label={t("home.searchLabel")}
                className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink placeholder:text-muted focus:outline-none md:text-sm"
                data-testid="home-search"
              />
              {/* Phones: a round arrow button, so the field keeps the width for typing. */}
              <button
                type="submit"
                aria-label={t("home.searchButton")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white transition hover:bg-brand-dark sm:w-auto sm:px-5"
              >
                <ArrowRight className="h-5 w-5 rtl:-scale-x-100 sm:hidden" aria-hidden />
                <span className="hidden sm:inline">{t("home.searchButton")}</span>
              </button>
            </form>
          </div>

          {/* Two doors: the two services, one tap each. */}
          <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:mt-8 sm:grid-cols-2">
            <Link href={`/${locale}/doctors`} className="group flex items-center gap-4 rounded-3xl border border-line bg-canvas p-5 transition hover:border-brand hover:shadow-float" data-testid="door-consult">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
                <Video className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span className="block font-semibold text-ink">{t("home.ctaConsult")}</span>
                <span className="block text-sm text-muted">{t("home.consultTrack.text")}</span>
              </span>
              <ArrowRight className="h-5 w-5 text-muted transition group-hover:translate-x-0.5 rtl:-scale-x-100" aria-hidden />
            </Link>
            <Link href={`/${locale}/surgery`} className="group flex items-center gap-4 rounded-3xl border border-line bg-canvas p-5 transition hover:border-trip hover:shadow-float" data-testid="door-surgery">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-trip-soft text-trip">
                <Scissors className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span className="block font-semibold text-ink">{t("home.ctaSurgery")}</span>
                <span className="block text-sm text-muted">{t("home.surgeryTrack.text")}</span>
              </span>
              <ArrowRight className="h-5 w-5 text-muted transition group-hover:translate-x-0.5 rtl:-scale-x-100" aria-hidden />
            </Link>
          </div>

          <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-soft">
            {[
              { icon: Stethoscope, text: t("home.facts.specialties.title", { n: specialties.length }) },
              { icon: Languages, text: t("home.facts.languages.text") },
              { icon: Lock, text: t("home.facts.privacy.text") },
            ].map((f) => (
              <li key={f.text} className="inline-flex items-center gap-1.5">
                <f.icon className="h-4 w-4 text-brand" aria-hidden />
                {f.text}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section>
        <Container className="py-10 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{t("home.specialtiesTitle")}</h2>
              <p className="mt-1 hidden text-muted sm:block">{t("home.specialtiesSubtitle")}</p>
            </div>
            <Link href={`/${locale}/doctors`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-dark hover:underline">
              {t("home.allSpecialties", { n: specialties.length })}
              <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {popular.map((s, i) => (
              <li key={s.id} className={i >= 8 ? "hidden sm:block" : undefined}>
                <Link
                  href={`/${locale}/doctors?specialty=${s.slug}`}
                  className="group flex h-full items-center gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-float sm:flex-col sm:items-start"
                  data-testid="home-specialty"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${specialtyTint(s.slug)}`}>
                    <SpecialtyIcon name={s.icon} className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-snug text-ink">{localized(s, "name", locale)}</span>
                    <span className="block text-xs text-muted">{s.doctorCount > 0 ? t("specialties.doctorCount", { n: s.doctorCount }) : t("specialties.soon")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {featured.length > 0 && (
        <section className="hidden bg-white md:block">
          <Container className="py-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink">{t("home.doctorsTitle")}</h2>
                <p className="mt-1 text-muted">{t("home.doctorsSubtitle")}</p>
              </div>
              <Link href={`/${locale}/doctors?q=`} className="text-sm font-semibold text-brand-dark hover:underline">
                {t("common.seeAll")}
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((d) => (
                <DoctorCard
                  key={d.id}
                  doctor={d}
                  locale={locale}
                  t={t}
                  fromPrice={d.fromPrice}
                  consultationPrice={d.consultation?.price ?? null}
                inPersonPrice={d.inPerson?.price ?? null}
                  specialty={d.specialty_ ? { name: localized(d.specialty_, "name", locale), icon: d.specialty_.icon, slug: d.specialty_.slug } : null}
                  currency={settings.currency}
                  nextSlot={d.nextSlot ? formatDate(d.nextSlot, locale, { day: "numeric", month: "short", year: undefined }) : null}
                  rating={d.rating}
                />
              ))}
            </div>
          </Container>
        </section>
      )}

      <section id="how" className="hidden scroll-mt-24 md:block">
        <Container className="py-14">
          <h2 className="text-2xl font-bold tracking-tight text-ink">{t("home.howTitle")}</h2>
          <p className="mt-1 text-muted">{t("home.howSubtitle")}</p>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {[
              { title: t("home.consultTrack.title"), text: t("home.consultTrack.text"), icon: Video, steps: consultSteps, key: "consultSteps", tone: "bg-brand text-white", href: `/${locale}/doctors`, cta: t("home.ctaConsult") },
              { title: t("home.surgeryTrack.title"), text: t("home.surgeryTrack.text"), icon: Hotel, steps: surgerySteps, key: "steps", tone: "bg-trip-soft text-trip", href: `/${locale}/surgery`, cta: t("home.ctaSurgery") },
            ].map((track) => (
              <div key={track.key} className="flex flex-col rounded-3xl border border-line bg-white p-7 shadow-card">
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${track.tone}`}>
                    <track.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-ink">{track.title}</h3>
                    <p className="text-sm text-muted">{track.text}</p>
                  </div>
                </div>
                <ol className="mt-6 flex-1 space-y-4">
                  {track.steps.map((Icon, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink-soft">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink">{t(`home.${track.key}.${i + 1}.title`)}</span>
                        <span className="block text-sm text-muted">{t(`home.${track.key}.${i + 1}.text`)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mt-6">
                  <LinkButton href={track.href} variant={track.key === "consultSteps" ? "primary" : "secondary"}>
                    {track.cta}
                  </LinkButton>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {stays.length > 0 && (
        <section className="hidden bg-white md:block">
          <Container className="py-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink">{t("home.staysTitle")}</h2>
                <p className="mt-1 text-muted">{t("home.staysSubtitle")}</p>
              </div>
              <Link href={`/${locale}/stays`} className="text-sm font-semibold text-brand-dark hover:underline">
                {t("common.seeAll")}
              </Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {stays.slice(0, 4).map((s) => (
                <StayCard key={s.id} stay={s} locale={locale} t={t} currency={settings.currency} />
              ))}
            </div>
          </Container>
        </section>
      )}

      <section>
        <Container className="grid gap-4 py-10 md:grid-cols-[2fr_1fr] md:py-14">
          <div className="rounded-3xl bg-brand px-6 py-8 text-white sm:px-10 sm:py-10">
            <h2 className="max-w-xl text-xl font-bold sm:text-2xl">{t("home.ctaTitle")}</h2>
            <p className="mt-2 max-w-xl text-white/85">{t("home.ctaText")}</p>
            <LinkButton href={`/${locale}/doctors`} size="lg" variant="secondary" className="mt-6">
              {t("home.ctaButton")}
            </LinkButton>
          </div>
          <div className="rounded-3xl border border-line bg-white p-6 sm:p-8">
            <Stethoscope className="h-7 w-7 text-brand" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold text-ink">{t("home.proTitle")}</h2>
            <p className="mt-1 text-sm text-muted">{t("home.proText", { email: settings.supportEmail })}</p>
          </div>
        </Container>
      </section>
    </>
  );
}
