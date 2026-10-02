import { ActionForm, SubmitButton } from "./forms";
import { Input } from "./ui";
import { refundPaymentAction } from "@/actions/admin-ops";
import { REFUND_REAUTH_THRESHOLD } from "@/lib/audit";
import type { TFunction } from "@/lib/i18n";

/** Full refund of one payment; above 500 the admin confirms with their password. */
export function RefundForm({ locale, payment, t }: { locale: string; payment: { id: string; amount: number }; t: TFunction }) {
  const reauth = payment.amount > REFUND_REAUTH_THRESHOLD * 100;
  return (
    <ActionForm action={refundPaymentAction.bind(null, locale, payment.id)} className="flex flex-wrap items-center gap-2">
      {reauth && <Input type="password" name="password" required placeholder={t("admin.reauth")} aria-label={t("admin.reauth")} className="w-44" autoComplete="current-password" />}
      <SubmitButton size="sm" variant="danger" confirmMessage={t("admin.refundConfirm")} testId="refund">
        {t("admin.refund")}
      </SubmitButton>
    </ActionForm>
  );
}
