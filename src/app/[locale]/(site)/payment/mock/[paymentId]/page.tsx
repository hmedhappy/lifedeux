import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/forms";
import { Container, Notice } from "@/components/ui";
import { mockCheckoutAction } from "@/actions/patient";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { mockPaymentsEnabled } from "@/lib/payments";

export default async function MockCheckoutPage({ params }: { params: Promise<{ locale: string; paymentId: string }> }) {
  const { locale: raw, paymentId } = await params;
  const locale = toLocale(raw);
  if (!mockPaymentsEnabled()) notFound();
  const t = getT(locale);
  const user = await requireRole(locale, ["PATIENT"]);
  const payment = await db.payment.findFirst({
    where: {
      id: paymentId,
      provider: "mock",
      status: "PENDING",
      OR: [{ booking: { patientId: user.id } }, { consultation: { patientId: user.id } }],
    },
    include: { booking: true, consultation: true },
  });
  if (!payment) notFound();

  const action = mockCheckoutAction.bind(null, locale, payment.id);
  return (
    <Container className="flex justify-center py-8 sm:py-16">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-line bg-white p-8 shadow-card">
        <h1 className="text-lg font-semibold text-ink">{t("payment.mockTitle")}</h1>
        <Notice tone="warning">{t("payment.mockInfo")}</Notice>
        <p className="text-3xl font-semibold text-ink">{formatMoney(payment.amount, payment.currency, locale)}</p>
        <p className="text-sm text-muted">{payment.booking?.reference ?? payment.consultation?.reference}</p>
        <form action={action} className="space-y-3">
          <SubmitButton size="lg" className="w-full" name="result" value="success">
            {t(payment.hold ? "payment.mockHold" : "payment.mockPay")}
          </SubmitButton>
        </form>
        <form action={action}>
          <SubmitButton size="lg" variant="secondary" className="w-full" name="result" value="failure">
            {t("payment.mockFail")}
          </SubmitButton>
        </form>
      </div>
    </Container>
  );
}
