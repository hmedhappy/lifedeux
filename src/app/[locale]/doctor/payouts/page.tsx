import { EmptyState, PageTitle, Stat, Table, Td, Th } from "@/components/ui";
import { requireDoctor } from "@/lib/auth";
import { doctorBalances } from "@/lib/bookings";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export default async function DoctorPayoutsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { doctor } = await requireDoctor(locale);
  const [balances, payouts, settings] = await Promise.all([
    doctorBalances(),
    db.doctorPayout.findMany({ where: { doctorId: doctor.id }, orderBy: { paidAt: "desc" } }),
    getSettings(),
  ]);
  const b = balances.get(doctor.id) ?? { earned: 0, paid: 0, operations: 0 };
  const money = (v: number) => formatMoney(v, settings.currency, locale);

  return (
    <div className="space-y-8">
      <PageTitle title={t("doctorArea.payoutsTitle")} subtitle={t("doctorArea.payoutsSubtitle")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("payouts.earned")} value={money(b.earned)} hint={t("payouts.operations", { n: b.operations })} />
        <Stat label={t("payouts.paid")} value={money(b.paid)} />
        <Stat label={t("payouts.balance")} value={money(b.earned - b.paid)} />
      </div>
      {payouts.length === 0 ? (
        <EmptyState title={t("payouts.none")} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("payouts.date")}</Th>
              <Th>{t("payouts.amount")}</Th>
              <Th>{t("payouts.note")}</Th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id}>
                <Td>{formatDate(p.paidAt, locale)}</Td>
                <Td>{money(p.amount)}</Td>
                <Td>{p.note ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
