import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  FileSignature,
  Hotel,
  ImagePlus,
  MessagesSquare,
  Plane,
  QrCode,
  Scissors,
  Search,
  ShieldCheck,
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

const TINTS = ["bg-rose-50 text-rose-600", "bg-sky-50 text-sky-600", "bg-emerald-50 text-emerald-600", "bg-amber-50 text-amber-600", "bg-violet-50 text-violet-600", "bg-teal-50 text-teal-600"];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const [specialties, doctors, stays, settings] = await Promise.all([
    listSpecialties(),
    listPublicDoctors(),
    listActiveStays(),
    getSettings(),
  ]);
  // Specialties with doctors first, so the grid never leads to empty results.
  const popular = [...specialties].sort((a, b) => Number(b.doctorCount > 0) - Number(a.doctorCount > 0) || a.sortOrder - b.sortOrder).slice(0, 12);
  const featured = [...doctors].sort((a, b) => Number(!!b.consultation) - Number(!!a.consultation)).slice(0, 3);

  const consultSteps = [Search, CalendarCheck, MessagesSquare, FileSignature];
  const surgerySteps = [Scissors, CalendarCheck, CreditCard, Plane, QrCode];

  return (
    <>
      <section className="border-b border-line">
        <Container className="grid items-center gap-10 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-brand-dark">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {t("home.badge")}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">{t("home.heroTitle")}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t("home.heroSubtitle")}</p>

            <form
              action={`/${locale}/doctors`}
              role="search"
              className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-line bg-white p-2 ps-6 shadow-float"
            >
              <label className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-ink">{t("home.searchLabel")}</span>
                <input
                  name="q"
                  placeholder={t("home.searchPlaceholder")}
                  className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
                  data-testid="home-search"
                />
              </label>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-dark px-5 py-3.5 text-sm font-semibold text-white"
              >
                <Search className="h-4 w-4" aria-hidden />
                {t("home.searchButton")}
              </button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href={`/${locale}/doctors`} variant="secondary">
                <Video className="h-4 w-4" aria-hidden />
                {t("home.ctaConsult")}
              </LinkButton>
              <LinkButton href={`/${locale}/doctors?service=operation`} variant="ghost" className="underline">
                <Scissors className="h-4 w-4" aria-hidden />
                {t("home.ctaSurgery")}
              </LinkButton>
            </div>

            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4 text-sm">
              {["specialties", "languages", "privacy"].map((k) => (
                <div key={k}>
                  <dt className="font-semibold text-ink">{t(`home.facts.${k}.title`, { n: specialties.length })}</dt>
                  <dd className="text-muted">{t(`home.facts.${k}.text`)}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Chat preview, purely decorative */}
          <div className="relative hidden lg:block" aria-hidden>
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-rose-100 via-white to-sky-100" />
            <div className="rounded-3xl border border-line bg-white shadow-float">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <Stethoscope className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{t("home.preview.doctor")}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {t("chat.live")}
                    </p>
                  </div>
                </div>
                <Video className="h-5 w-5 text-muted/50" />
              </div>
              <div className="space-y-3 bg-surface/60 px-5 py-6 text-sm">
                <p className="max-w-[75%] rounded-2xl rounded-es-md bg-white px-4 py-2.5 text-ink shadow-sm">{t("home.preview.m1")}</p>
                <p className="ms-auto max-w-[75%] rounded-2xl rounded-ee-md bg-gradient-to-br from-brand to-brand-dark px-4 py-2.5 text-white shadow-sm">
                  {t("home.preview.m2")}
                </p>
                <p className="ms-auto flex w-40 items-center justify-center gap-2 rounded-2xl bg-white/70 py-6 text-muted">
                  <ImagePlus className="h-5 w-5" /> photo.jpg
                </p>
                <div className="flex max-w-[80%] items-center gap-3 rounded-2xl bg-emerald-50 p-3 text-emerald-900">
                  <FileSignature className="h-7 w-7 shrink-0" />
                  <span>
                    <span className="block font-semibold">{t("chat.prescription")}</span>
                    <span className="block text-xs opacity-80">RX-… · {t("home.preview.certified")}</span>
                  </span>
                  <BadgeCheck className="ms-auto h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("home.specialtiesTitle")}</h2>
              <p className="mt-2 text-muted">{t("home.specialtiesSubtitle")}</p>
            </div>
            <Link href={`/${locale}/doctors`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink underline">
              {t("home.allSpecialties", { n: specialties.length })}
              <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {popular.map((s, i) => (
              <li key={s.id}>
                <Link
                  href={`/${locale}/doctors?specialty=${s.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-line p-4 transition hover:-translate-y-0.5 hover:shadow-float"
                  data-testid="home-specialty"
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${TINTS[i % TINTS.length]}`}>
                    <SpecialtyIcon name={s.icon} className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-ink">{localized(s, "name", locale)}</span>
                  <span className="mt-auto text-xs text-muted">{t("specialties.doctorCount", { n: s.doctorCount })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section id="how" className="scroll-mt-24 bg-surface">
        <Container className="py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("home.howTitle")}</h2>
          <p className="mt-2 text-muted">{t("home.howSubtitle")}</p>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Track
              title={t("home.consultTrack.title")}
              text={t("home.consultTrack.text")}
              icon={<Video className="h-6 w-6" aria-hidden />}
              steps={consultSteps.map((Icon, i) => ({
                icon: <Icon className="h-4 w-4" aria-hidden />,
                title: t(`home.consultSteps.${i + 1}.title`),
                text: t(`home.consultSteps.${i + 1}.text`),
              }))}
              cta={<LinkButton href={`/${locale}/doctors`}>{t("home.ctaConsult")}</LinkButton>}
              accent
            />
            <Track
              title={t("home.surgeryTrack.title")}
              text={t("home.surgeryTrack.text")}
              icon={<Hotel className="h-6 w-6" aria-hidden />}
              steps={surgerySteps.map((Icon, i) => ({
                icon: <Icon className="h-4 w-4" aria-hidden />,
                title: t(`home.steps.${i + 1}.title`),
                text: t(`home.steps.${i + 1}.text`),
              }))}
              cta={
                <LinkButton href={`/${locale}/doctors?service=operation`} variant="secondary">
                  {t("home.ctaSurgery")}
                </LinkButton>
              }
            />
          </div>
        </Container>
      </section>

      {featured.length > 0 && (
        <section>
          <Container className="py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("home.doctorsTitle")}</h2>
                <p className="mt-2 text-muted">{t("home.doctorsSubtitle")}</p>
              </div>
              <Link href={`/${locale}/doctors?q=`} className="text-sm font-semibold text-ink underline">
                {t("common.seeAll")}
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((d) => (
                <DoctorCard
                  key={d.id}
                  doctor={d}
                  locale={locale}
                  t={t}
                  fromPrice={d.fromPrice}
                  consultationPrice={d.consultation?.price ?? null}
                  specialty={d.specialty_ ? { name: localized(d.specialty_, "name", locale), icon: d.specialty_.icon } : null}
                  currency={settings.currency}
                  nextSlot={d.nextSlot ? formatDate(d.nextSlot, locale, { day: "numeric", month: "short", year: undefined }) : null}
                />
              ))}
            </div>
          </Container>
        </section>
      )}

      {stays.length > 0 && (
        <section className="bg-surface">
          <Container className="py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("home.staysTitle")}</h2>
                <p className="mt-2 text-muted">{t("home.staysSubtitle")}</p>
              </div>
              <Link href={`/${locale}/stays`} className="text-sm font-semibold text-ink underline">
                {t("common.seeAll")}
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {stays.slice(0, 4).map((s) => (
                <StayCard key={s.id} stay={s} locale={locale} t={t} currency={settings.currency} />
              ))}
            </div>
          </Container>
        </section>
      )}

      <section>
        <Container className="grid gap-6 py-16 lg:grid-cols-[2fr_1fr]">
          <div className="overflow-hidden rounded-3xl bg-ink px-8 py-12 text-white sm:px-14">
            <h2 className="max-w-2xl text-2xl font-semibold sm:text-3xl">{t("home.ctaTitle")}</h2>
            <p className="mt-3 max-w-2xl text-white/75">{t("home.ctaText")}</p>
            <LinkButton href={`/${locale}/doctors`} size="lg" className="mt-8">
              {t("home.ctaButton")}
            </LinkButton>
          </div>
          <div className="rounded-3xl border border-line p-8">
            <Stethoscope className="h-8 w-8 text-brand" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold text-ink">{t("home.proTitle")}</h2>
            <p className="mt-2 text-sm text-muted">{t("home.proText", { email: settings.supportEmail })}</p>
          </div>
        </Container>
      </section>
    </>
  );
}

function Track({
  title,
  text,
  icon,
  steps,
  cta,
  accent = false,
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
  steps: { icon: React.ReactNode; title: string; text: string }[];
  cta: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`flex flex-col rounded-3xl border p-7 ${accent ? "border-brand/20 bg-white shadow-float" : "border-line bg-white"}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent ? "bg-gradient-to-br from-brand to-brand-dark text-white" : "bg-surface text-ink"}`}>
          {icon}
        </span>
        <div>
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <p className="text-sm text-muted">{text}</p>
        </div>
      </div>
      <ol className="mt-6 flex-1 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-brand">{s.icon}</span>
            <span>
              <span className="block text-sm font-semibold text-ink">{s.title}</span>
              <span className="block text-sm text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6">{cta}</div>
    </div>
  );
}
