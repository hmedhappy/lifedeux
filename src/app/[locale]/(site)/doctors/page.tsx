import Link from "next/link";
import { Search } from "lucide-react";
import { DoctorCard } from "@/components/cards";
import { SpecialtyBrowser, type SpecialtyTile } from "@/components/specialty-browser";
import { SpecialtyIcon } from "@/components/specialty-icon";
import { Container, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getT, localized, toLocale, type Locale } from "@/lib/i18n";
import { listPublicDoctors, listSpecialties } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("doctors.title") };
}

export default async function DoctorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ specialty?: string; q?: string; operation?: string; service?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { specialty: specialtySlug, q, operation, service } = await searchParams;
  const surgeryOnly = service === "operation";
  const t = getT(locale);
  const [specialties, settings] = await Promise.all([listSpecialties(), getSettings()]);
  const current = specialties.find((s) => s.slug === specialtySlug) ?? null;
  const showDoctors = !!current || q !== undefined || !!operation || surgeryOnly;
  const doctors = showDoctors ? await listPublicDoctors({ specialtySlug: current?.slug, q, operationSlug: operation, surgeryOnly }) : [];

  const tiles: SpecialtyTile[] = specialties.map((s) => ({
    slug: s.slug,
    name: localized(s, "name", locale),
    names: [s.nameFr, s.nameEn, s.nameAr],
    icon: s.icon,
    count: s.doctorCount,
  }));

  if (!showDoctors) {
    return (
      <>
        <section className="border-b border-line bg-gradient-to-b from-rose-50/60 to-white">
          <Container className="py-12 text-center sm:py-16">
            <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-ink [text-wrap:balance] sm:text-4xl">
              {t("specialties.title")}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted">{t("specialties.subtitle")}</p>
          </Container>
        </section>
        <Container className="py-10">
          <SpecialtyBrowser specialties={tiles} />
        </Container>
      </>
    );
  }

  return (
    <Container className="py-10">
      <Link href={`/${locale}/doctors`} className="text-sm font-medium text-ink underline">
        ← {t("specialties.all")}
      </Link>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          {current && (
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-dark">
              <SpecialtyIcon name={current.icon} className="h-7 w-7" />
            </span>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {current
                ? localized(current, "name", locale)
                : q?.trim()
                  ? t("doctors.resultsFor", { q: q.trim() })
                  : surgeryOnly
                    ? t("doctors.surgeons")
                    : t("doctors.allDoctors")}
            </h1>
            <p className="mt-1 text-muted">{t("doctors.found", { n: doctors.length })}</p>
          </div>
        </div>
        <form className="flex w-full max-w-sm items-center gap-2 rounded-full border border-line bg-white py-1.5 ps-4 pe-1.5" role="search">
          {current && <input type="hidden" name="specialty" value={current.slug} />}
          {surgeryOnly && <input type="hidden" name="service" value="operation" />}
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t("doctors.searchPlaceholder")}
            aria-label={t("doctors.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm focus:outline-none"
            data-testid="doctor-search"
          />
          <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
            {t("common.search")}
          </button>
        </form>
      </div>

      <div className="mt-8">
        {doctors.length === 0 ? (
          <EmptyState title={t("doctors.empty")} text={t("doctors.emptyText")} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((d) => (
              <DoctorCard
                key={d.id}
                doctor={d}
                locale={locale}
                t={t}
                fromPrice={d.fromPrice}
                consultationPrice={d.consultation?.price ?? null}
                specialty={d.specialty_ ? { name: localized(d.specialty_, "name", locale), icon: d.specialty_.icon } : null}
                currency={settings.currency}
                nextSlot={shortDate(d.nextSlot, locale)}
              />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}

function shortDate(date: Date | null, locale: Locale) {
  return date ? formatDate(date, locale, { day: "numeric", month: "short", year: undefined }) : null;
}
