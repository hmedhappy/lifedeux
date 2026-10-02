"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { sendLoginCodeAction, verifyLoginCodeAction } from "@/actions/auth";
import { useI18n } from "./i18n-provider";
import { Button, Field, Input, Notice } from "./ui";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

/**
 * Passwordless sign-in: email → 6-digit code → (new account) first and last name.
 * With `onSignedIn`, the parent continues (e.g. sends the booking) instead of navigating.
 */
export function AuthPanel({
  next,
  googleEnabled,
  onSignedIn,
  intro,
}: {
  next?: string;
  googleEnabled: boolean;
  onSignedIn?: () => void;
  intro?: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code" | "profile">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    start(async () => {
      const res = await sendLoginCodeAction(locale, email);
      if (!res.ok) return setError(t(res.error));
      setStep("code");
      setCode("");
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await verifyLoginCodeAction(locale, {
        email,
        code,
        next,
        ...(step === "profile" ? { firstName, lastName, consent } : {}),
      });
      if (!res.ok) {
        if (res.needsProfile) {
          if (step === "profile") setError(t(res.error));
          setStep("profile");
          return;
        }
        return setError(t(res.error));
      }
      if (onSignedIn) {
        router.refresh();
        onSignedIn();
      } else {
        router.push(res.redirect ?? `/${locale}`);
        router.refresh();
      }
    });
  }

  const googleHref = `/api/auth/google/start?locale=${locale}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="space-y-4" data-testid="auth-panel">
      {intro && step === "email" && <p className="text-sm text-muted">{intro}</p>}
      {error && <Notice tone="error">{error}</Notice>}

      {step === "email" && (
        <>
          {googleEnabled && (
            <>
              <a href={googleHref} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-line-strong bg-white text-sm font-semibold text-ink transition hover:bg-surface">
                <GoogleLogo />
                {t("auth.google")}
              </a>
              <p className="flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
                {t("auth.or")}
              </p>
            </>
          )}
          <form onSubmit={sendCode} className="space-y-3">
            <Field label={t("fields.email")}>
              <Input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="auth-email"
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending || !email} data-testid="auth-send-code">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
              {t("auth.sendCode")}
            </Button>
          </form>
        </>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-ink-soft">{t("auth.codeSent", { email })}</p>
          <Field label={t("auth.code")}>
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
              className="text-center font-mono text-2xl tracking-[0.4em]"
              required
              autoFocus
              data-testid="auth-code"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={pending || code.replace(/\s/g, "").length < 6} data-testid="auth-verify">
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t("auth.verify")}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => setStep("email")} className="inline-flex min-h-11 items-center gap-1 text-muted hover:text-ink">
              <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
              {t("auth.changeEmail")}
            </button>
            <button type="button" onClick={() => sendCode()} disabled={pending} className="min-h-11 font-semibold text-brand-dark hover:underline">
              {t("auth.resend")}
            </button>
          </div>
        </form>
      )}

      {step === "profile" && (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-ink-soft">{t("auth.newAccount")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("fields.firstName")}>
              <Input name="firstName" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus data-testid="auth-first-name" />
            </Field>
            <Field label={t("fields.lastName")}>
              <Input name="lastName" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required data-testid="auth-last-name" />
            </Field>
          </div>
          <p className="text-xs text-muted">{t("fields.latinHint")}</p>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-brand" data-testid="auth-consent" />
            <span>{t("auth.consentGeneral")}</span>
          </label>
          <Button type="submit" size="lg" className="w-full" disabled={pending || !consent} data-testid="auth-create">
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t("auth.createAndContinue")}
          </Button>
        </form>
      )}
    </div>
  );
}
