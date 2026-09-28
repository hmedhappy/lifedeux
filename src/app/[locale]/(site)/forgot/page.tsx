import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Container, Field, Input } from "@/components/ui";
import { requestPasswordResetAction } from "@/actions/auth";
import { getT, toLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("auth.forgotTitle") };
}

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return (
    <Container className="flex justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-line p-8">
        <h1 className="text-center text-lg font-semibold text-ink">{t("auth.forgotTitle")}</h1>
        <p className="mt-1 text-center text-sm text-muted">{t("auth.forgotSubtitle")}</p>
        <ActionForm action={requestPasswordResetAction.bind(null, locale)} className="mt-8 space-y-4">
          <Field label={t("fields.email")}>
            <Input type="email" name="email" autoComplete="email" required />
          </Field>
          <SubmitButton size="lg" className="w-full">
            {t("auth.forgotButton")}
          </SubmitButton>
        </ActionForm>
        <p className="mt-6 text-center text-sm">
          <Link href={`/${locale}/login`} className="font-semibold text-ink underline">
            {t("auth.loginLink")}
          </Link>
        </p>
      </div>
    </Container>
  );
}
