"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Notice } from "./ui";
import { useI18n } from "./i18n-provider";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} name={name} value={value}>
      {pending ? t("common.loading") : children}
    </Button>
  );
}

/** A form bound to a server action returning { error | success } message keys. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const { t } = useI18n();
  return (
    <form
      action={formAction}
      className={className}
      key={resetOnSuccess && state?.success ? state.nonce : undefined}
    >
      {state?.error && (
        <div className="mb-4">
          <Notice tone="error">{t(state.error, state.vars)}</Notice>
        </div>
      )}
      {state?.success && (
        <div className="mb-4">
          <Notice tone="success">
            {t(state.success, state.vars)}
            {state.detail && <span className="mt-1 block break-all font-mono text-xs">{state.detail}</span>}
          </Notice>
        </div>
      )}
      {children}
    </form>
  );
}

export function ConfirmSubmit({
  children,
  message,
  variant = "danger",
  size = "sm",
}: {
  children: React.ReactNode;
  message: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
