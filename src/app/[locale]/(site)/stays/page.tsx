import { StayCard } from "@/components/cards";
import { Container, EmptyState, PageTitle } from "@/components/ui";
import { getT, toLocale } from "@/lib/i18n";
import { listActiveStays } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("stays.title") };
}

export default async function StaysPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const [stays, settings] = await Promise.all([listActiveStays(), getSettings()]);

  return (
    <Container className="py-10">
      <PageTitle title={t("stays.title")} subtitle={t("stays.subtitle")} />
      {stays.length === 0 ? (
        <EmptyState title={t("stays.empty")} />
      ) : (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {stays.map((s) => (
            <div key={s.id}>
              <StayCard stay={s} locale={locale} t={t} currency={settings.currency} />
              {s.amenities.length > 0 && (
                <p className="mt-2 line-clamp-2 text-xs text-muted">{s.amenities.join(" · ")}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
