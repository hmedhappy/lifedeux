import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Container, Field, Input, Notice, PageTitle, Select } from "@/components/ui";
import { updateProfileAction } from "@/actions/patient";
import { requireRole } from "@/lib/auth";
import { getT, toLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("nav.profile") };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ complete?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { complete } = await searchParams;
  const t = getT(locale);
  const user = await requireRole(locale, ["PATIENT"], `/${locale}/account/profile`);

  return (
    <Container className="max-w-2xl py-6 sm:py-10">
      <PageTitle title={t("nav.profile")} subtitle={user.email} />
      {complete && (
        <div className="mb-5">
          <Notice tone="warning">{t("profile.complete")}</Notice>
        </div>
      )}
      <Card>
        <ActionForm action={updateProfileAction.bind(null, locale)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.firstName")}>
              <Input name="firstName" defaultValue={user.firstName} autoComplete="given-name" required />
            </Field>
            <Field label={t("fields.lastName")}>
              <Input name="lastName" defaultValue={user.lastName} autoComplete="family-name" required />
            </Field>
          </div>
          <p className="-mt-1 text-xs text-muted">{t("fields.latinHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.phoneOptional")} hint={t("fields.phoneHint")}>
              <Input type="tel" name="phone" defaultValue={user.phone ?? ""} autoComplete="tel" />
            </Field>
            <Field label={t("fields.countryOptional")}>
              <Input name="country" defaultValue={user.country ?? ""} autoComplete="country-name" />
            </Field>
            <Field label={t("fields.birthDate")} hint={t("fields.birthDateHint")}>
              <Input type="date" name="birthDate" defaultValue={user.birthDate?.toISOString().slice(0, 10) ?? ""} />
            </Field>
            <Field label={t("common.language")}>
              <Select name="locale" defaultValue={user.locale}>
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </Select>
            </Field>
          </div>
          <SubmitButton>{t("common.save")}</SubmitButton>
        </ActionForm>
      </Card>
    </Container>
  );
}
