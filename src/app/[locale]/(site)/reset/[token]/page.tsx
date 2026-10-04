import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Container, Field, Input, Notice } from "@/components/ui";
import { acceptInviteAction } from "@/actions/auth";
import { db } from "@/lib/db";
import { getT, toLocale } from "@/lib/i18n";

/** Also "create my password" (`?new=1`), linked from booking emails of accounts made by email code. */
export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { locale: raw, token } = await params;
  const isNew = (await searchParams).new === "1";
  const locale = toLocale(raw);
  const t = getT(locale);
  const user = await db.user.findUnique({ where: { inviteToken: token } });
  const valid = user && user.active && user.inviteExpiresAt && user.inviteExpiresAt > new Date();

  return (
    <Container className="flex justify-center py-8 sm:py-16">
      <div className="w-full max-w-md animate-fade-in rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
        <h1 className="text-center text-xl font-bold tracking-tight text-ink">{t(isNew ? "auth.createPasswordTitle" : "auth.resetTitle")}</h1>
        {!valid ? (
          <div className="mt-6 space-y-4 text-center">
            <Notice tone="error">{t("errors.resetInvalid")}</Notice>
            <Link href={`/${locale}/forgot`} className="text-sm font-semibold underline">
              {t("auth.forgotButton")}
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-1 text-center text-sm text-muted">{t(isNew ? "auth.createPasswordSubtitle" : "auth.resetSubtitle", { email: user.email })}</p>
            <ActionForm action={acceptInviteAction.bind(null, locale, token)} className="mt-8 space-y-4">
              <Field label={t("fields.password")} hint={t("fields.passwordHint")}>
                <Input type="password" name="password" autoComplete="new-password" minLength={8} required />
              </Field>
              <Field label={t("fields.passwordConfirm")}>
                <Input type="password" name="confirm" autoComplete="new-password" minLength={8} required />
              </Field>
              <SubmitButton size="lg" className="w-full">
                {t(isNew ? "auth.createPasswordButton" : "auth.resetButton")}
              </SubmitButton>
            </ActionForm>
          </>
        )}
      </div>
    </Container>
  );
}
