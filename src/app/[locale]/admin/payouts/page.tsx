import { Download, FileText } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, LinkButton, PageTitle, Select, Table, Td, Th } from "@/components/ui";
import { recordPayoutAction } from "@/actions/admin";
import { recordMonthlyBatchAction } from "@/actions/admin-ops";
import { requireRole } from "@/lib/auth";
import { doctorBalances } from "@/lib/bookings";
import { db } from "@/lib/db";
import { formatDate, formatMoney, tunisDayKey } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

const METHODS = ["CASH", "TRANSFER"] as const;

export default async function AdminPayoutsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { month: rawMonth } = await searchParams;
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const month = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : tunisDayKey(new Date()).slice(0, 7);
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
  const empty = { earned: 0, paid: 0, operations: 0, consultations: 0 };
  const due = doctors.map((d) => ({ d, b: balances.get(d.id) ?? empty })).filter(({ b }) => b.earned > 0 || b.paid > 0);
  const totalDue = due.reduce((s, { b }) => s + Math.max(0, b.earned - b.paid), 0);

  return (
    <div className="space-y-8">
      <PageTitle
        title={t("admin.payoutsTitle")}
        subtitle={t("admin.payoutsSubtitle")}
        action={
          <form className="flex items-center gap-2">
            <Input type="month" name="month" defaultValue={month} aria-label={t("payouts.month")} className="w-40" />
            <SubmitButton variant="secondary" size="sm">
              {t("payouts.show")}
            </SubmitButton>
          </form>
        }
      />

      <Table>
        <thead>
          <tr>
            <Th>{t("admin.col.doctor")}</Th>
            <Th>{t("payouts.acts")}</Th>
            <Th>{t("payouts.earned")}</Th>
            <Th>{t("payouts.paid")}</Th>
            <Th>{t("payouts.balance")}</Th>
            <Th>{t("payouts.statement", { month })}</Th>
          </tr>
        </thead>
        <tbody>
          {due.map(({ d, b }) => (
            <tr key={d.id}>
              <Td>
                Dr {d.user.firstName} {d.user.lastName}
              </Td>
              <Td>{b.operations + b.consultations}</Td>
              <Td>{money(b.earned)}</Td>
              <Td>{money(b.paid)}</Td>
              <Td className={b.earned - b.paid < 0 ? "font-semibold text-amber-700" : "font-semibold"}>{money(b.earned - b.paid)}</Td>
              <Td>
                <a href={`/api/admin/payouts/statement?doctorId=${d.id}&month=${month}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-medium text-brand-dark">
                  <FileText className="h-4 w-4" aria-hidden />
                  PDF
                </a>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-ink">{t("payouts.batchTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("payouts.batchText", { total: money(totalDue) })}</p>
          <ActionForm action={recordMonthlyBatchAction.bind(null, locale)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={t("payouts.method")}>
              <Select name="method" defaultValue="TRANSFER">
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`payoutMethod.${m}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("payouts.note")}>
              <Input name="note" maxLength={300} defaultValue={t("payouts.batchNote", { month })} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton confirmMessage={t("payouts.batchConfirm", { total: money(totalDue) })} testId="payout-batch">
                {t("payouts.batchButton")}
              </SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-ink">{t("admin.recordPayout")}</h2>
          <p className="mt-1 text-sm text-muted">{t("payouts.overHint")}</p>
          <ActionForm action={recordPayoutAction.bind(null, locale)} className="mt-4 grid gap-3 sm:grid-cols-2" resetOnSuccess>
            <Field label={t("admin.col.doctor")}>
              <Select name="doctorId" required>
                {doctors.map((d) => {
                  const b = balances.get(d.id) ?? empty;
                  return (
                    <option key={d.id} value={d.id}>
                      Dr {d.user.lastName} · {t("payouts.dueShort", { amount: money(b.earned - b.paid) })}
                    </option>
                  );
                })}
              </Select>
            </Field>
            <Field label={t("payouts.amount")}>
              <Input name="amount" inputMode="decimal" required />
            </Field>
            <Field label={t("payouts.method")}>
              <Select name="method" defaultValue="CASH">
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`payoutMethod.${m}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("payouts.date")}>
              <Input type="date" name="paidAt" defaultValue={tunisDayKey(new Date())} required />
            </Field>
            <Field label={t("payouts.note")} className="sm:col-span-2">
              <Input name="note" maxLength={300} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>{t("admin.recordPayoutButton")}</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">{t("payouts.history")}</h2>
          <LinkButton href={`/api/admin/payouts/export?month=${month}`} variant="secondary" size="sm" prefetch={false} data-testid="payout-export">
            <Download className="h-4 w-4" aria-hidden />
            {t("payouts.export", { month })}
          </LinkButton>
        </div>
        {history.length === 0 ? (
          <p className="rounded-2xl bg-surface p-4 text-sm text-muted">{t("payouts.none")}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("payouts.date")}</Th>
                <Th>{t("admin.col.doctor")}</Th>
                <Th>{t("payouts.amount")}</Th>
                <Th>{t("payouts.method")}</Th>
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
                  <Td>{t(`payoutMethod.${p.method}`)}</Td>
                  <Td>{p.note ?? "—"}</Td>
                  <Td>{p.recordedBy.firstName}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
