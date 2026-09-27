import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageTitle, Select, Table, Td, Th } from "@/components/ui";
import { recordPayoutAction } from "@/actions/admin";
import { requireRole } from "@/lib/auth";
import { doctorBalances } from "@/lib/bookings";
import { db } from "@/lib/db";
import { formatDate, formatMoney, tunisDayKey } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export default async function AdminPayoutsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const [doctors, balances, history, settings] = await Promise.all([
    db.doctor.findMany({ include: { user: true }, orderBy: { createdAt: "asc" } }),
    doctorBalances(),
    db.doctorPayout.findMany({
      include: { doctor: { include: { user: true } }, recordedBy: true },
      orderBy: { paidAt: "desc" },
      take: 100,
    }),
    getSettings(),
  ]);
  const money = (v: number) => formatMoney(v, settings.currency, locale);

  return (
    <div className="space-y-10">
      <PageTitle title={t("admin.payoutsTitle")} subtitle={t("admin.payoutsSubtitle")} />
      <Table>
        <thead>
          <tr>
            <Th>{t("admin.col.doctor")}</Th>
            <Th>{t("payouts.operationsCol")}</Th>
            <Th>{t("payouts.earned")}</Th>
            <Th>{t("payouts.paid")}</Th>
            <Th>{t("payouts.balance")}</Th>
          </tr>
        </thead>
        <tbody>
          {doctors.map((d) => {
            const b = balances.get(d.id) ?? { earned: 0, paid: 0, operations: 0 };
            return (
              <tr key={d.id}>
                <Td>
                  Dr {d.user.firstName} {d.user.lastName}
                </Td>
                <Td>{b.operations}</Td>
                <Td>{money(b.earned)}</Td>
                <Td>{money(b.paid)}</Td>
                <Td className="font-semibold">{money(b.earned - b.paid)}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <Card>
        <h2 className="text-lg font-semibold text-ink">{t("admin.recordPayout")}</h2>
        <p className="mt-1 text-sm text-muted">{t("admin.recordPayoutHint")}</p>
        <ActionForm action={recordPayoutAction.bind(null, locale)} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" resetOnSuccess>
          <Field label={t("admin.col.doctor")}>
            <Select name="doctorId" required>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr {d.user.firstName} {d.user.lastName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("payouts.amount")}>
            <Input name="amount" inputMode="decimal" required />
          </Field>
          <Field label={t("payouts.date")}>
            <Input type="date" name="paidAt" defaultValue={tunisDayKey(new Date())} required />
          </Field>
          <Field label={t("payouts.note")}>
            <Input name="note" maxLength={300} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <SubmitButton>{t("admin.recordPayoutButton")}</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      {history.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>{t("payouts.date")}</Th>
              <Th>{t("admin.col.doctor")}</Th>
              <Th>{t("payouts.amount")}</Th>
              <Th>{t("payouts.note")}</Th>
              <Th>{t("admin.recordedBy")}</Th>
            </tr>
          </thead>
          <tbody>
            {history.map((p) => (
              <tr key={p.id}>
                <Td>{formatDate(p.paidAt, locale)}</Td>
                <Td>Dr {p.doctor.user.lastName}</Td>
                <Td>{money(p.amount)}</Td>
                <Td>{p.note ?? "—"}</Td>
                <Td>{p.recordedBy.firstName}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
