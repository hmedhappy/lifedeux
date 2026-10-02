import Link from "next/link";
import { FileText, QrCode } from "lucide-react";
import { Badge, Container, EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("nav.documents") };
}

/** Prescriptions and QR tickets in one place, ready to show at the pharmacy or the airport. */
export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const user = await requireRole(locale, ["PATIENT"], `/${locale}/account/documents`);
  const [prescriptions, tickets] = await Promise.all([
    db.prescription.findMany({
      where: { patientId: user.id, status: { in: ["ISSUED", "REVOKED"] } },
      include: { doctor: { include: { user: true } }, _count: { select: { items: true } } },
      orderBy: { issuedAt: "desc" },
    }),
    db.booking.findMany({
      where: { patientId: user.id, qrToken: { not: null }, status: { in: ["PAID", "IN_PROGRESS", "COMPLETED"] } },
      include: { operation: true, slot: true },
      orderBy: { slot: { startsAt: "desc" } },
    }),
  ]);

  return (
    <Container className="max-w-3xl py-6 sm:py-10">
      <PageTitle title={t("nav.documents")} subtitle={t("documents.subtitle")} />
      {prescriptions.length === 0 && tickets.length === 0 ? (
        <EmptyState icon={FileText} title={t("documents.empty")} text={t("documents.emptyText")} action={<LinkButton href={`/${locale}/account`} variant="secondary">{t("nav.appointments")}</LinkButton>} />
      ) : (
        <div className="space-y-8">
          {prescriptions.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">{t("documents.prescriptions")}</h2>
              <ul className="space-y-3">
                {prescriptions.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-card" data-testid="document-prescription">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                      <FileText className="h-6 w-6" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">
                        {t("chat.prescription")} · Dr {p.doctor.user.lastName}
                      </p>
                      <p className="text-sm text-muted">
                        {p.number} · {p.issuedAt ? formatDate(p.issuedAt, locale) : ""} · {t("documents.items", { n: p._count.items })}
                      </p>
                    </div>
                    {p.status === "REVOKED" ? (
                      <Badge tone="red">{t("documents.revoked")}</Badge>
                    ) : (
                      <LinkButton href={`/api/prescriptions/${p.id}/pdf`} variant="soft" size="sm" target="_blank" prefetch={false}>
                        {t("chat.download")}
                      </LinkButton>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {tickets.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">{t("documents.tickets")}</h2>
              <ul className="space-y-3">
                {tickets.map((b) => (
                  <li key={b.id}>
                    <Link href={`/${locale}/account/bookings/${b.id}/ticket`} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-card transition hover:shadow-float">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-trip-soft text-trip">
                        <QrCode className="h-6 w-6" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{localized(b.operation, "name", locale)}</p>
                        <p className="text-sm text-muted">
                          {b.reference} · {formatDate(b.slot.startsAt, locale)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Container>
  );
}
