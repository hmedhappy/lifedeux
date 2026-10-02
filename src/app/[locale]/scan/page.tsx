import Link from "next/link";
import { redirect } from "next/navigation";
import { QrScanner } from "@/components/qr-scanner";
import { Button, Card, EmptyState, Input, Notice, PageTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, formatDate, tunisDayKey } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";

export default async function ScanHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const user = await requireRole(locale, ["AGENT", "ADMIN"]);
  const { ref } = await searchParams;

  let notFound = false;
  if (ref) {
    const booking = await db.booking.findUnique({ where: { reference: ref.trim().toUpperCase() } });
    if (booking?.qrToken) redirect(`/${locale}/scan/${booking.qrToken}`);
    notFound = true;
  }

  const now = new Date();
  const bookings = await db.booking.findMany({
    where: {
      status: { in: ["PAID", "IN_PROGRESS"] },
      OR: [
        { arrivalDate: { gte: addDays(now, -1), lte: addDays(now, 2) } },
        { departureDate: { gte: addDays(now, -1), lte: addDays(now, 2) } },
      ],
    },
    include: { patient: true, accommodation: true },
    orderBy: { arrivalDate: "asc" },
  });
  const today = tunisDayKey(now);
  const mine = await db.booking.findMany({
    where: { agentId: user.id, status: { in: ["PAID", "IN_PROGRESS"] } },
    include: { patient: true, slot: true },
    orderBy: { slot: { startsAt: "asc" } },
  });

  return (
    <div className="space-y-8">
      <PageTitle title={t("scan.title")} subtitle={t("scan.subtitle")} />
      <Card>
        <QrScanner />
        <form className="mt-6 flex gap-2 border-t border-line pt-6">
          <Input name="ref" placeholder="LD-XXXXXX" aria-label={t("scan.reference")} defaultValue={ref} className="font-mono uppercase" />
          <Button type="submit" variant="dark">
            {t("scan.find")}
          </Button>
        </form>
        {notFound && (
          <div className="mt-4">
            <Notice tone="error">{t("scan.notFound")}</Notice>
          </div>
        )}
      </Card>

      {mine.length > 0 && (
        <section data-testid="scan-mine">
          <h2 className="mb-3 text-lg font-semibold text-ink">{t("scan.mine")}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-card">
            {mine.map((b) => (
              <li key={b.id}>
                <Link href={`/${locale}/scan/${b.qrToken}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface">
                  <span className="font-medium text-ink">
                    {b.patient.firstName} {b.patient.lastName}
                  </span>
                  <span className="text-sm text-muted">
                    {b.reference} · {formatDate(b.slot.startsAt, locale, { year: undefined })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">{t("scan.movements")}</h2>
        {bookings.length === 0 ? (
          <EmptyState title={t("scan.noMovements")} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-card">
            {bookings.map((b) => {
              const arriving = b.arrivalDate && tunisDayKey(b.arrivalDate) >= today && b.status === "PAID";
              return (
                <li key={b.id}>
                  <Link href={`/${locale}/scan/${b.qrToken}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface">
                    <span>
                      <span className="block font-medium text-ink">
                        {b.patient.firstName} {b.patient.lastName} · {1 + b.companionsCount}
                      </span>
                      <span className="text-sm text-muted">
                        {b.reference} · {b.accommodation?.title ?? t("scan.noStay")}
                      </span>
                    </span>
                    <span className="text-sm text-ink">
                      {arriving
                        ? `${t("scan.arrival")} ${b.arrivalDate ? formatDate(b.arrivalDate, locale, { year: undefined }) : ""}`
                        : `${t("scan.departure")} ${b.departureDate ? formatDate(b.departureDate, locale, { year: undefined }) : ""}`}
                      {b.withTransport && <span className="ms-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{t("scan.transfer")}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
