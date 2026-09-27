import Link from "next/link";
import clsx from "clsx";
import { DoctorCard } from "@/components/cards";
import { Container, EmptyState, PageTitle } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";
import { listActiveOperations, listPublicDoctors } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("doctors.title") };
}

export default async function DoctorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ operation?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { operation } = await searchParams;
  const t = getT(locale);
  const [operations, doctors, settings] = await Promise.all([
    listActiveOperations(),
    listPublicDoctors(operation),
    getSettings(),
  ]);

  return (
    <Container className="py-10">
      <PageTitle title={t("doctors.title")} subtitle={t("doctors.subtitle")} />

      {operations.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href={`/${locale}/doctors`}
            className={clsx(
              "rounded-full border px-4 py-2 text-sm",
              !operation ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
            )}
          >
            {t("doctors.allOperations")}
          </Link>
          {operations.map((op) => (
            <Link
              key={op.id}
              href={`/${locale}/doctors?operation=${op.slug}`}
              className={clsx(
                "rounded-full border px-4 py-2 text-sm",
                operation === op.slug ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
              )}
            >
              {localized(op, "name", locale)}
            </Link>
          ))}
        </div>
      )}

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
              currency={settings.currency}
              nextSlot={d.nextSlot ? formatDate(d.nextSlot, locale, { day: "numeric", month: "short", year: undefined }) : null}
            />
          ))}
        </div>
      )}
    </Container>
  );
}
