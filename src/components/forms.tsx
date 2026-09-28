"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
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
  const status = useFormStatus();
  const actionPending = useContext(PendingContext);
  const pending = status.pending || actionPending;
  const { t } = useI18n();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} name={name} value={value}>
      {pending ? t("common.loading") : children}
    </Button>
  );
}

const PendingContext = createContext(false);

/**
 * A form bound to a server action returning { error | success } message keys.
 * Submissions go through startTransition instead of the native form action so
 * React does not clear the fields: after an error the user keeps what they typed.
 */
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
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (resetOnSuccess && state?.success) formRef.current?.reset();
  }, [resetOnSuccess, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(data));
      }}
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
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
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
