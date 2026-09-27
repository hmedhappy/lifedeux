import Link from "next/link";
import { DoctorCard, StayCard } from "@/components/cards";
import { Container, LinkButton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { listActiveOperations, listActiveStays, listPublicDoctors } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

const stepIcons = [
  "M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z",
  "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  "M5 13l4 4L19 7",
  "M3 10h18M7 15h2m-4 4h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z",
  "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z",
];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const [operations, doctors, stays, settings] = await Promise.all([
    listActiveOperations(),
    listPublicDoctors(),
    listActiveStays(),
    getSettings(),
  ]);

  const services = [
    { key: "appointment", icon: stepIcons[1] },
    { key: "transfer", icon: "M8 17h8M6 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm16 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM2 17V7a2 2 0 0 1 2-2h11l5 5v7" },
    { key: "stay", icon: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6" },
    { key: "payment", icon: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" },
  ];

  return (
    <>
      <section className="border-b border-line">
        <Container className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-brand-dark">
              {t("home.badge")}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t("home.heroSubtitle")}</p>

            <form
              action={`/${locale}/doctors`}
              className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-line bg-white p-2 ps-6 shadow-float"
            >
              <label className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-ink">{t("home.searchLabel")}</span>
                <select
                  name="operation"
                  className="w-full truncate bg-transparent text-sm text-muted focus:outline-none"
                  defaultValue={operations[0]?.slug}
                >
                  {operations.map((op) => (
                    <option key={op.id} value={op.slug}>
                      {localized(op, "name", locale)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-dark px-5 py-3.5 text-sm font-semibold text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                  <path d={stepIcons[0]} />
                </svg>
                {t("home.searchButton")}
              </button>
            </form>

            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4 text-sm">
              {["care", "languages", "privacy"].map((k) => (
                <div key={k}>
                  <dt className="font-semibold text-ink">{t(`home.facts.${k}.title`)}</dt>
                  <dd className="text-muted">{t(`home.facts.${k}.text`)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`rounded-3xl p-6 ${i % 3 === 0 ? "bg-gradient-to-br from-brand to-brand-dark text-white" : "bg-surface text-ink"} ${i === 1 ? "translate-y-8" : ""} ${i === 3 ? "translate-y-8" : ""}`}
                >
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d={services[i].icon} />
                  </svg>
                  <p className="mt-10 text-lg font-semibold">{t(`home.services.${services[i].key}.title`)}</p>
                  <p className={`mt-1 text-sm ${i % 3 === 0 ? "text-white/85" : "text-muted"}`}>
                    {t(`home.services.${services[i].key}.text`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section id="how" className="scroll-mt-24">
        <Container className="py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("home.howTitle")}</h2>
          <p className="mt-2 text-muted">{t("home.howSubtitle")}</p>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n} className="relative rounded-2xl border border-line p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-brand">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d={stepIcons[n - 1]} />
                  </svg>
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("home.stepLabel", { n })}
                </p>
                <p className="mt-1 font-semibold text-ink">{t(`home.steps.${n}.title`)}</p>
                <p className="mt-1 text-sm text-muted">{t(`home.steps.${n}.text`)}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-surface">
        <Container className="py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("home.doctorsTitle")}</h2>
              <p className="mt-2 text-muted">{t("home.doctorsSubtitle")}</p>
            </div>
            <Link href={`/${locale}/doctors`} className="text-sm font-semibold text-ink underline">
              {t("common.seeAll")}
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.slice(0, 3).map((d) => (
              <DoctorCard
                key={d.id}
                doctor={d}
                locale={locale}
                t={t}
                fromPrice={d.fromPrice}
                currency={settings.currency}
                nextSlot={d.nextSlot ? formatDate(d.nextSlot, locale, { day: "numeric", month: "short", year: undefined }) : null}
              />
            ))}
          </div>
        </Container>
      </section>

      {stays.length > 0 && (
        <section>
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
        <Container>
          <div className="overflow-hidden rounded-3xl bg-ink px-8 py-12 text-white sm:px-14">
            <h2 className="max-w-2xl text-2xl font-semibold sm:text-3xl">{t("home.ctaTitle")}</h2>
            <p className="mt-3 max-w-2xl text-white/75">{t("home.ctaText")}</p>
            <LinkButton href={`/${locale}/doctors`} size="lg" className="mt-8">
              {t("home.ctaButton")}
            </LinkButton>
          </div>
        </Container>
      </section>
    </>
  );
}
