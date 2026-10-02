import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Notice, PageTitle } from "@/components/ui";
import { saveSettingsAction } from "@/actions/admin";
import { requireRole } from "@/lib/auth";
import { centsToInput } from "@/lib/format";
import { getT, toLocale } from "@/lib/i18n";
import { availableProviders } from "@/lib/payments";
import { getSettings } from "@/lib/settings";

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  await requireRole(locale, ["ADMIN"]);
  const settings = await getSettings();
  const providers = availableProviders().map((p) => p.id);

  return (
    <div className="space-y-8">
      <PageTitle title={t("admin.settingsTitle")} />
      <Card>
        <ActionForm action={saveSettingsAction.bind(null, locale)} className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.settings.currency")} hint={t("admin.settings.currencyHint")}>
            <Input name="currency" defaultValue={settings.currency} maxLength={3} required />
          </Field>
          <Field label={t("admin.settings.transportPrice")}>
            <Input name="transportPricePerPerson" inputMode="decimal" defaultValue={centsToInput(settings.transportPricePerPerson)} required />
          </Field>
          <Field label={t("admin.settings.deadline")}>
            <Input type="number" name="paymentDeadlineHours" min={1} max={720} defaultValue={settings.paymentDeadlineHours} required />
          </Field>
          <Field label={t("admin.settings.maxCompanions")}>
            <Input type="number" name="maxCompanions" min={0} max={10} defaultValue={settings.maxCompanions} required />
          </Field>
          <Field label={t("admin.settings.supportPhone")}>
            <Input name="supportPhone" defaultValue={settings.supportPhone} required />
          </Field>
          <Field label={t("admin.settings.supportWhatsapp")} hint={t("admin.settings.supportWhatsappHint")}>
            <Input name="supportWhatsapp" defaultValue={settings.supportWhatsapp} inputMode="tel" required />
          </Field>
          <Field label={t("admin.settings.supportEmail")}>
            <Input type="email" name="supportEmail" defaultValue={settings.supportEmail} required />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>{t("common.save")}</SubmitButton>
          </div>
        </ActionForm>
      </Card>
      <Card>
        <h2 className="font-semibold text-ink">{t("admin.settings.providers")}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(["stripe", "konnect", "mock"] as const).map((id) => (
            <li key={id} className="flex items-center justify-between gap-4">
              <span>{t(`pay.providers.${id}.title`)}</span>
              <span className={providers.includes(id) ? "font-semibold text-emerald-700" : "text-muted"}>
                {providers.includes(id) ? t("admin.settings.enabled") : t("admin.settings.disabled")}
              </span>
            </li>
          ))}
        </ul>
        {providers.includes("mock") && (
          <div className="mt-4">
            <Notice tone="warning">{t("admin.settings.mockWarning")}</Notice>
          </div>
        )}
      </Card>
    </div>
  );
}
