import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Container, Field, Input } from "@/components/ui";
import { registerAction } from "@/actions/auth";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { getT, toLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("auth.registerTitle") };
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { next } = await searchParams;
  const t = getT(locale);
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}${homeFor(user.role)}`);

  return (
    <Container className="flex justify-center py-16">
      <div className="w-full max-w-lg rounded-2xl border border-line p-8">
        <h1 className="text-center text-lg font-semibold text-ink">{t("auth.registerTitle")}</h1>
        <p className="mt-1 text-center text-sm text-muted">{t("auth.registerSubtitle")}</p>
        <ActionForm action={registerAction.bind(null, locale)} className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.firstName")}>
              <Input name="firstName" autoComplete="given-name" required />
            </Field>
            <Field label={t("fields.lastName")}>
              <Input name="lastName" autoComplete="family-name" required />
            </Field>
          </div>
          <Field label={t("fields.email")}>
            <Input type="email" name="email" autoComplete="email" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.phone")} hint={t("fields.phoneHint")}>
              <Input type="tel" name="phone" autoComplete="tel" required />
            </Field>
            <Field label={t("fields.country")}>
              <Input name="country" autoComplete="country-name" required />
            </Field>
          </div>
          <Field label={t("fields.password")} hint={t("fields.passwordHint")}>
            <Input type="password" name="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 accent-brand" />
            <span>{t("auth.consent")}</span>
          </label>
          <SubmitButton size="lg" className="w-full">
            {t("auth.registerButton")}
          </SubmitButton>
        </ActionForm>
        <p className="mt-6 text-center text-sm text-muted">
          {t("auth.haveAccount")}{" "}
          <Link
            href={`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-ink underline"
          >
            {t("auth.loginLink")}
          </Link>
        </p>
      </div>
    </Container>
  );
}
