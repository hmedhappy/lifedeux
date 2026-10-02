import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, BedDouble, CalendarDays, Car, HeartHandshake, MapPin, Scissors, Star } from "lucide-react";
import { PriceSimulator } from "@/components/price-simulator";
import { Avatar, Container, EmptyState, LinkButton } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { listActiveStays, surgeryCatalogue } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("surgery.title") };
}

export default async function SurgeryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ op?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { op } = await searchParams;
  const t = getT(locale);
  const [catalogue, stays, settings] = await Promise.all([surgeryCatalogue(), listActiveStays(), getSettings()]);
  const money = (v: number) => formatMoney(v, settings.currency, locale);
  const selected = catalogue.find((o) => o.slug === op) ?? null;

  return (
    <Container className="py-6 sm:py-10">
      <header className="max-w-2xl">
        <p className="inline-flex items-center gap-2 rounded-full bg-trip-soft px-3 py-1 text-sm font-semibold text-trip">
          <Scissors className="h-4 w-4" aria-hidden />
          {t("surgery.kicker")}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("surgery.title")}</h1>
        <p className="mt-2 text-muted">{t("surgery.subtitle")}</p>
      </header>

      <ul className="mt-6 flex flex-wrap gap-2 text-sm text-ink-soft">
        {[
          { icon: Car, label: t("doctor.included.transfer") },
          { icon: BedDouble, label: t("doctor.included.stay") },
          { icon: HeartHandshake, label: t("doctor.included.support") },
        ].map(({ icon: Icon, label }) => (
          <li key={label} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5">
            <Icon className="h-4 w-4 text-trip" aria-hidden />
            {label}
          </li>
        ))}
      </ul>

      {catalogue.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={Scissors} title={t("surgery.empty")} text={t("surgery.emptyText")} />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-8">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">{t("surgery.chooseOperation")}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {catalogue.map((o) => {
                  const from = Math.min(...o.surgeons.map((s) => s.price));
                  const active = selected?.id === o.id;
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/${locale}/surgery?op=${o.slug}#surgeons`}
                        scroll={false}
                        className={clsx(
                          "flex h-full flex-col rounded-3xl border bg-white p-5 shadow-card transition hover:shadow-float",
                          active ? "border-trip ring-2 ring-trip/20" : "border-line",
                        )}
                        data-testid="surgery-operation"
                        aria-current={active || undefined}
                      >
                        <span className="font-semibold text-ink">{localized(o, "name", locale)}</span>
                        <span className="mt-1 line-clamp-2 text-sm text-muted">{localized(o, "description", locale)}</span>
                        <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
                          <span className="font-semibold text-trip">{t("surgery.from", { price: money(from) })}</span>
                          <span className="text-muted">
                            {t("surgery.surgeons", { n: o.surgeons.length })} · {t("booking.nights", { n: o.defaultRecoveryNights })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            {selected && (
              <section id="surgeons" className="scroll-mt-24" data-testid="surgery-surgeons">
                <h2 className="mb-3 text-lg font-semibold text-ink">{t("surgery.compare", { name: localized(selected, "name", locale) })}</h2>
                <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-card">
                  {selected.surgeons.map((s) => (
                    <li key={s.id}>
                      <Link href={`/${locale}/doctors/${s.id}?service=operation`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-surface" data-testid="surgery-surgeon">
                        <Avatar name={s.name.replace("Dr ", "")} src={s.photoUrl} size={48} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-ink">{s.name}</span>
                          <span className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" aria-hidden />
                              {s.clinic}, {s.city}
                            </span>
                            {s.rating && (
                              <span className="inline-flex items-center gap-1">
                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                                {s.rating.average} ({s.rating.count})
                              </span>
                            )}
                            {s.years > 0 && <span>{t("surgery.years", { n: s.years })}</span>}
                          </span>
                        </span>
                        <span className="text-end">
                          <span className="block text-lg font-bold text-ink">{money(s.price)}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                            {s.nextSlot ? formatDate(s.nextSlot, locale, { year: undefined }) : t("surgery.noDate")}
                          </span>
                        </span>
                        <ArrowRight className="h-5 w-5 text-muted rtl:-scale-x-100" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside>
            <div className="rounded-3xl border border-line bg-white p-5 shadow-card lg:sticky lg:top-24">
              <h2 className="mb-4 font-semibold text-ink">{t("surgery.simulator")}</h2>
              {selected ? (
                <>
                  <PriceSimulator
                    key={selected.id}
                    surgeons={selected.surgeons.map((s) => ({ id: s.id, name: s.name, price: s.price }))}
                    stays={stays.map((s) => ({ id: s.id, title: s.title, pricePerNight: s.pricePerNight, capacity: s.capacity }))}
                    nights={selected.defaultRecoveryNights + 1}
                    transportPricePerPerson={settings.transportPricePerPerson}
                    maxCompanions={settings.maxCompanions}
                    currency={settings.currency}
                  />
                  <LinkButton href={`/${locale}/doctors/${selected.surgeons[0].id}?service=operation`} className="mt-4 w-full" size="lg">
                    {t("surgery.request")}
                  </LinkButton>
                </>
              ) : (
                <p className="text-sm text-muted">{t("surgery.pickFirst")}</p>
              )}
            </div>
          </aside>
        </div>
      )}
    </Container>
  );
}
