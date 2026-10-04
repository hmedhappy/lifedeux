import Link from "next/link";
import { ArrowRight, Search, SearchX } from "lucide-react";
import { DoctorCard } from "@/components/cards";
import { DoctorFilters } from "@/components/doctor-filters";
import { SpecialtyBrowser, type SpecialtyTile } from "@/components/specialty-browser";
import { SpecialtyIcon } from "@/components/specialty-icon";
import { Container, EmptyState, LinkButton } from "@/components/ui";
import { specialtyTint } from "@/lib/specialty-tint";
import { specialtiesForSymptom } from "@/lib/symptoms";
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
  searchParams: Promise<{ specialty?: string; q?: string; operation?: string; service?: string; sort?: string; mode?: string; lat?: string; lng?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const sp = await searchParams;
  const { specialty: specialtySlug, q, operation, service } = sp;
  const sort = sp.sort === "rating" || sp.sort === "near" ? sp.sort : "soon";
  const mode = sp.mode === "cabinet" || sp.mode === "online" ? sp.mode : undefined;
  const lat = Number(sp.lat), lng = Number(sp.lng);
  const near = sort === "near" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  const surgeryOnly = service === "operation";
  const t = getT(locale);
  const [specialties, settings] = await Promise.all([listSpecialties(), getSettings()]);
  const current = specialties.find((s) => s.slug === specialtySlug) ?? null;
  const showDoctors = !!current || q !== undefined || !!operation || surgeryOnly || !!mode || sort !== "soon";
  const doctors = showDoctors ? await listPublicDoctors({ specialtySlug: current?.slug, q, operationSlug: operation, surgeryOnly, mode, sort, near }) : [];
  const filterParams = { specialty: current?.slug, q, operation, service, sort: sort === "soon" ? undefined : sort, mode, lat: near ? sp.lat : undefined, lng: near ? sp.lng : undefined };
  const symptomSlugs = q ? specialtiesForSymptom(q) : [];
  const suggested = specialties.filter((s) => symptomSlugs.includes(s.slug));

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
        <section className="border-b border-line bg-white">
          <Container className="py-10 text-center sm:py-14">
            <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-ink [text-wrap:balance] sm:text-4xl">
              {t("specialties.title")}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted">{t("specialties.subtitle")}</p>
          </Container>
        </section>
        <Container className="py-8 sm:py-10">
          <div className="mb-6">
            <DoctorFilters base={`/${locale}/doctors`} params={{}} idle />
          </div>
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
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${specialtyTint(current.slug)}`}>
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
        <form className="flex w-full max-w-sm items-center gap-2 rounded-full border border-line-strong bg-white py-1.5 ps-4 pe-1.5" role="search">
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
          {sort !== "soon" && <input type="hidden" name="sort" value={sort} />}
          {mode && <input type="hidden" name="mode" value={mode} />}
          {near && (
            <>
              <input type="hidden" name="lat" value={sp.lat} />
              <input type="hidden" name="lng" value={sp.lng} />
            </>
          )}
          <button
            type="submit"
            aria-label={t("common.search")}
            className="flex min-h-10 min-w-10 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white hover:bg-brand-dark sm:px-4"
          >
            <ArrowRight className="h-5 w-5 rtl:-scale-x-100 sm:hidden" aria-hidden />
            <span className="hidden sm:inline">{t("common.search")}</span>
          </button>
        </form>
      </div>

      <div className="mt-5">
        <DoctorFilters base={`/${locale}/doctors`} params={filterParams} />
      </div>

      {suggested.length > 0 && !current && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm" data-testid="symptom-suggestions">
          <span className="text-muted">{t("doctors.suggested")}</span>
          {suggested.map((s) => (
            <Link key={s.slug} href={`/${locale}/doctors?specialty=${s.slug}`} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 font-semibold ${specialtyTint(s.slug)}`}>
              <SpecialtyIcon name={s.icon} className="h-4 w-4" />
              {localized(s, "name", locale)}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        {doctors.length === 0 ? (
          <EmptyState title={t("doctors.empty")} text={t("doctors.emptyText")} icon={SearchX} action={<LinkButton href={`/${locale}/doctors`} variant="secondary">{t("specialties.all")}</LinkButton>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((d) => (
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
                nextSlot={shortDate(d.nextSlot, locale)}
                rating={d.rating}
                distance={near ? d.distance : null}
                service={surgeryOnly || operation ? "operation" : mode === "cabinet" ? "cabinet" : undefined}
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
