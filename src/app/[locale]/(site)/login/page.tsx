import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Container, Field, Input } from "@/components/ui";
import { loginAction } from "@/actions/auth";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { getT, toLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return { title: getT(toLocale((await params).locale))("auth.loginTitle") };
}

export default async function LoginPage({
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
      <div className="w-full max-w-md rounded-2xl border border-line p-8">
        <h1 className="text-center text-lg font-semibold text-ink">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-center text-sm text-muted">{t("auth.loginSubtitle")}</p>
        <ActionForm action={loginAction.bind(null, locale)} className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label={t("fields.email")}>
            <Input type="email" name="email" autoComplete="email" required />
          </Field>
          <Field label={t("fields.password")}>
            <Input type="password" name="password" autoComplete="current-password" required />
          </Field>
          <SubmitButton size="lg" className="w-full">
            {t("auth.loginButton")}
          </SubmitButton>
        </ActionForm>
        <p className="mt-6 text-center text-sm text-muted">
          {t("auth.noAccount")}{" "}
          <Link
            href={`/${locale}/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-ink underline"
          >
            {t("auth.registerLink")}
          </Link>
        </p>
      </div>
    </Container>
  );
}
