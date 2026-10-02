import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { RefundForm } from "@/components/refund-form";
import { StatusBadge } from "@/components/status";
import { Badge, Card, Disclosure, Input } from "@/components/ui";
import { adminRevokePrescriptionAction } from "@/actions/admin-ops";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getT, localized, toLocale } from "@/lib/i18n";

/**
 * Admin view of a consultation. The conversation itself stays private between patient
 * and doctor: only its metadata (counts, prescriptions, payments) is shown here.
 */
export default async function AdminConsultationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const c = await db.consultation.findUnique({
    where: { id },
    include: {
      patient: true,
      slot: true,
      doctor: { include: { user: true, specialty_: true } },
      payments: { orderBy: { createdAt: "desc" } },
      prescriptions: { where: { status: { in: ["ISSUED", "REVOKED"] } }, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" } },
      review: true,
      _count: { select: { messages: true } },
    },
  });
  if (!c) notFound();
  const money = (v: number) => formatMoney(v, c.currency, locale);

  return (
    <div className="space-y-6">
      <Link href={`/${locale}/admin/consultations`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-soft">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        {t("admin.consultationsTitle")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-ink">{c.reference}</h1>
        <StatusBadge status={c.status} t={t} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <dl className="space-y-2 text-sm">
            <Row label={t("doctorArea.patient")} value={`${c.patient.firstName} ${c.patient.lastName} · ${c.patient.email}`} />
            <Row label={t("admin.col.doctor")} value={`Dr ${c.doctor.user.firstName} ${c.doctor.user.lastName}`} />
            <Row label={t("admin.doctor.specialty")} value={c.doctor.specialty_ ? localized(c.doctor.specialty_, "name", locale) : c.doctor.specialty} />
            <Row label={t("doctorArea.slot")} value={formatDateTime(c.slot.startsAt, locale)} />
            <Row label={t("admin.col.activity")} value={t("admin.col.messages", { n: c._count.messages })} />
            {c.orientation && <Row label={t("admin.orientation")} value={c.orientation} />}
          </dl>
        </Card>
        <Card>
          <dl className="space-y-2 text-sm">
            <Row label={t("price.total")} value={money(c.price)} />
            <Row label={t("doctorArea.fee")} value={money(c.doctorFee)} />
            {c.refusalReason && <Row label={t("admin.refusal")} value={c.refusalReason} />}
            {c.review && <Row label={t("review.title")} value={`${c.review.rating}/5${c.review.text ? ` — ${c.review.text}` : ""}`} />}
          </dl>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-ink">{t("admin.paymentsTitle")}</h2>
        {c.payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("admin.noPayments")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line text-sm">
            {c.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  {formatDateTime(p.createdAt, locale)} · {p.provider} {p.hold && `· ${t("paymentStatus.AUTHORIZED")}`} · {money(p.amount)}
                </span>
                <span className="flex items-center gap-3">
                  <Badge tone={p.status === "SUCCEEDED" ? "green" : p.status === "PENDING" || p.status === "AUTHORIZED" ? "amber" : "gray"}>
                    {t(`paymentStatus.${p.status}`)}
                  </Badge>
                  {p.status === "SUCCEEDED" && <RefundForm locale={locale} payment={p} t={t} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-ink">{t("documents.prescriptions")}</h2>
        {c.prescriptions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("admin.noPrescriptions")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line text-sm">
            {c.prescriptions.map((p) => (
              <li key={p.id} className="space-y-2 py-3" data-testid="admin-rx">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand" aria-hidden />
                    <Link href={`/${locale}/verify/${p.number}`} className="font-mono underline" target="_blank">
                      {p.number}
                    </Link>
                    {p.status === "REVOKED" && <Badge tone="red">{t("documents.revoked")}</Badge>}
                  </span>
                  <span className="text-muted">
                    {p.issuedAt ? formatDateTime(p.issuedAt, locale) : "—"} · {t("documents.items", { n: p._count.items })} ·{" "}
                    <span className="font-mono">{p.contentHash?.slice(0, 12).toUpperCase()}</span>
                  </span>
                </div>
                {p.status === "REVOKED" && p.revokeReason && <p className="text-xs text-muted">{p.revokeReason}</p>}
                {p.status === "ISSUED" && (
                  <Disclosure summary={t("admin.revokeRx")}>
                    <p className="mb-2 text-xs text-muted">{t("admin.revokeRxHint")}</p>
                    <ActionForm action={adminRevokePrescriptionAction.bind(null, locale, p.id)} className="flex flex-wrap gap-2">
                      <Input name="reason" required maxLength={300} placeholder={t("admin.revokeReason")} className="min-w-60 flex-1" />
                      <SubmitButton variant="danger" size="sm" confirmMessage={t("admin.revokeConfirm", { number: p.number ?? "" })}>
                        {t("admin.revoke")}
                      </SubmitButton>
                    </ActionForm>
                  </Disclosure>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium text-ink">{value}</dd>
    </div>
  );
}
