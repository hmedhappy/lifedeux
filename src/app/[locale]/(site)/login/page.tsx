import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LogoMark } from "@/components/header";
import { Container, Disclosure, Field, Input, Notice } from "@/components/ui";
import { loginAction } from "@/actions/auth";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { googleEnabled } from "@/lib/google-auth";
import { getT, toLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("auth.loginTitle") };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const { next, error } = await searchParams;
  const t = getT(locale);
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}${homeFor(user.role)}`);

  return (
    <Container className="flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
        <LogoMark className="mx-auto h-11 w-11" />
        <h1 className="mt-4 text-center text-xl font-bold text-ink">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-center text-sm text-muted">{t("auth.loginSubtitleCode")}</p>
        {error === "google" && (
          <div className="mt-5">
            <Notice tone="error">{t("auth.googleError")}</Notice>
          </div>
        )}
        <div className="mt-6">
          <AuthPanel next={next} googleEnabled={googleEnabled()} />
        </div>
        <Disclosure summary={t("auth.withPassword")} className="mt-6 border-t border-line pt-3">
          <ActionForm action={loginAction.bind(null, locale)} className="space-y-4 pt-2">
            <input type="hidden" name="next" value={next ?? ""} />
            <Field label={t("fields.email")}>
              <Input type="email" name="email" autoComplete="email" required />
            </Field>
            <Field label={t("fields.password")}>
              <Input type="password" name="password" autoComplete="current-password" required />
            </Field>
            <p className="text-end text-sm">
              <Link href={`/${locale}/forgot`} className="text-ink underline">
                {t("auth.forgotLink")}
              </Link>
            </p>
            <SubmitButton size="lg" className="w-full" testId="password-login">
              {t("auth.loginButton")}
            </SubmitButton>
          </ActionForm>
        </Disclosure>
      </div>
    </Container>
  );
}
