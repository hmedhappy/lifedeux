import Link from "next/link";
import { notFound } from "next/navigation";
import { StayForm } from "@/components/admin-forms";
import { Card, PageTitle } from "@/components/ui";
import { saveStayAction } from "@/actions/admin";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";

export default async function EditStayPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const stay = await db.accommodation.findUnique({
    where: { id },
    include: {
      bookings: {
        where: { status: { in: ["PAID", "IN_PROGRESS", "CONFIRMED"] }, departureDate: { gt: new Date() } },
        include: { patient: true },
        orderBy: { arrivalDate: "asc" },
      },
    },
  });
  if (!stay) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/${locale}/admin/stays`} className="text-sm font-medium underline">
        ← {t("admin.staysTitle")}
      </Link>
      <PageTitle title={stay.title} subtitle={stay.address} />
      {stay.bookings.length > 0 && (
        <Card>
          <h2 className="font-semibold text-ink">{t("admin.stay.upcoming")}</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {stay.bookings.map((b) => (
              <li key={b.id}>
                {b.arrivalDate && formatDate(b.arrivalDate, locale)} → {b.departureDate && formatDate(b.departureDate, locale)} ·{" "}
                {b.patient.firstName} {b.patient.lastName} ({b.reference})
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <StayForm action={saveStayAction.bind(null, locale, stay.id)} t={t} stay={stay} />
      </Card>
    </div>
  );
}
