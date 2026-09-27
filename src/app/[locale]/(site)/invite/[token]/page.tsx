import { ActionForm, SubmitButton } from "@/components/forms";
import { Container, Field, Input, Notice } from "@/components/ui";
import { acceptInviteAction } from "@/actions/auth";
import { db } from "@/lib/db";
import { getT, toLocale } from "@/lib/i18n";

export default async function InvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: raw, token } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const user = await db.user.findUnique({ where: { inviteToken: token } });
  const valid = user && user.inviteExpiresAt && user.inviteExpiresAt > new Date();

  return (
    <Container className="flex justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-line p-8">
        <h1 className="text-center text-lg font-semibold text-ink">{t("auth.inviteTitle")}</h1>
        {!valid ? (
          <div className="mt-6">
            <Notice tone="error">{t("errors.inviteInvalid")}</Notice>
          </div>
        ) : (
          <>
            <p className="mt-1 text-center text-sm text-muted">
              {t("auth.inviteSubtitle", { name: user.firstName, email: user.email })}
            </p>
            <ActionForm action={acceptInviteAction.bind(null, locale, token)} className="mt-8 space-y-4">
              <Field label={t("fields.password")} hint={t("fields.passwordHint")}>
                <Input type="password" name="password" autoComplete="new-password" minLength={8} required />
              </Field>
              <Field label={t("fields.passwordConfirm")}>
                <Input type="password" name="confirm" autoComplete="new-password" minLength={8} required />
              </Field>
              <SubmitButton size="lg" className="w-full">
                {t("auth.inviteButton")}
              </SubmitButton>
            </ActionForm>
          </>
        )}
      </div>
    </Container>
  );
}
