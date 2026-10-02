import { Disclosure, EmptyState, PageTitle, Stat, Table, Td, Th } from "@/components/ui";
import { requireDoctor } from "@/lib/auth";
import { doctorBalances } from "@/lib/bookings";
import { db } from "@/lib/db";
import { formatDate, formatMoney, fromTunisLocal, tunisDayKey } from "@/lib/format";
import { addDayKey } from "@/lib/schedule-rules";
import { getT, localized, toLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

/** First day of the month five months ago (six months shown), Tunis time. */
function sixMonthsAgo(): Date {
  const key = tunisDayKey(new Date());
  let month = `${key.slice(0, 7)}-01`;
  for (let i = 0; i < 5; i++) month = `${addDayKey(month, -1).slice(0, 7)}-01`;
  return fromTunisLocal(month, "00:00");
}

export default async function DoctorPayoutsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { doctor } = await requireDoctor(locale);
  const since = sixMonthsAgo();
  const [balances, payouts, settings, consults, ops] = await Promise.all([
    doctorBalances(),
    db.doctorPayout.findMany({ where: { doctorId: doctor.id }, orderBy: { paidAt: "desc" } }),
    getSettings(),
    db.consultation.findMany({
      where: { doctorId: doctor.id, status: { in: ["COMPLETED", "NO_SHOW"] }, slot: { startsAt: { gte: since } } },
      include: { slot: true, patient: { select: { firstName: true, lastName: true } } },
    }),
    db.booking.findMany({
      where: { doctorId: doctor.id, status: { in: ["IN_PROGRESS", "COMPLETED"] }, slot: { startsAt: { gte: since } } },
      include: { slot: true, operation: true, patient: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  type Act = { id: string; at: Date; label: string; who: string; fee: number };
  const acts: Act[] = [
    ...consults.map((c) => ({
      id: c.id,
      at: c.slot.startsAt,
      label: c.status === "NO_SHOW" ? `${t("consult.short")} · ${t("status.NO_SHOW")}` : t("consult.short"),
      who: `${c.patient.firstName} ${c.patient.lastName.charAt(0)}.`,
      fee: c.doctorFee,
    })),
    ...ops.map((b) => ({
      id: b.id,
      at: b.slot.startsAt,
      label: localized(b.operation, "name", locale),
      who: `${b.patient.firstName} ${b.patient.lastName.charAt(0)}.`,
      fee: b.doctorFee,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const months = new Map<string, Act[]>();
  for (const a of acts) {
    const key = tunisDayKey(a.at).slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), a]);
  }
  const b = balances.get(doctor.id) ?? { earned: 0, paid: 0, operations: 0, consultations: 0 };
  const money = (v: number) => formatMoney(v, settings.currency, locale);

  return (
    <div className="space-y-8">
      <PageTitle title={t("doctorArea.payoutsTitle")} subtitle={t("doctorArea.payoutsSubtitle")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("payouts.earned")} value={money(b.earned)} hint={t("today.monthActs", { n: b.operations + b.consultations })} />
        <Stat label={t("payouts.paid")} value={money(b.paid)} />
        <Stat label={t("payouts.balance")} value={money(b.earned - b.paid)} />
      </div>
      <section data-testid="earnings-months">
        <h2 className="mb-3 text-lg font-semibold text-ink">{t("payouts.byMonth")}</h2>
        {months.size === 0 ? (
          <p className="rounded-2xl bg-surface p-4 text-sm text-muted">{t("payouts.noActs")}</p>
        ) : (
          <div className="divide-y divide-line rounded-3xl border border-line bg-white px-5 shadow-card">
            {[...months.entries()].map(([key, list], i) => (
              <Disclosure
                key={key}
                defaultOpen={i === 0}
                summary={
                  <span className="flex flex-1 items-center justify-between gap-3">
                    <span className="capitalize">{formatDate(new Date(`${key}-15T12:00:00Z`), locale, { month: "long", year: "numeric", day: undefined })}</span>
                    <span>
                      {money(list.reduce((s, a) => s + a.fee, 0))} <span className="font-normal text-muted">· {t("today.monthActs", { n: list.length })}</span>
                    </span>
                  </span>
                }
              >
                <ul className="space-y-1.5 pb-2 text-sm">
                  {list.map((a) => (
                    <li key={a.id} className="flex flex-wrap justify-between gap-2">
                      <span className="text-ink">
                        {formatDate(a.at, locale)} · {a.label} · <span className="text-muted">{a.who}</span>
                      </span>
                      <span className="font-medium text-ink">{money(a.fee)}</span>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            ))}
          </div>
        )}
      </section>

      <h2 className="text-lg font-semibold text-ink">{t("payouts.received")}</h2>
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
