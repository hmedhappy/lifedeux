"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, Notice, type Variant } from "./ui";
import { useI18n } from "./i18n-provider";
import { ConfirmSheet } from "./overlay";
import { useToast } from "./toast";
import type { ActionState } from "@/lib/action-state";

const noopSubscribe = () => () => {};

/** False during server rendering and before hydration, true once React runs in the browser. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * Submit button with a pending state. With `confirmMessage`, the click first opens a
 * confirmation sheet; the form is submitted (with this button as submitter) on confirm.
 */
function ConfirmableSubmit({
  children,
  variant,
  size,
  className,
  name,
  value,
  confirmMessage,
  confirmLabel,
  pending,
  disabled,
  testId,
}: {
  children: React.ReactNode;
  variant: Variant;
  size: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  value?: string;
  confirmMessage?: string;
  confirmLabel?: string;
  pending: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const confirmed = useRef(false);
  const [asking, setAsking] = useState(false);
  const { t } = useI18n();
  return (
    <>
      <Button
        ref={ref}
        type="submit"
        variant={variant}
        size={size}
        className={className}
        disabled={pending || disabled}
        name={name}
        value={value}
        data-testid={testId}
        onClick={(e) => {
          if (!confirmMessage) return;
          if (confirmed.current) {
            confirmed.current = false;
            return;
          }
          e.preventDefault();
          setAsking(true);
        }}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span className="sr-only">{t("common.loading")}</span>
            {children}
          </>
        ) : (
          children
        )}
      </Button>
      {confirmMessage && (
        <ConfirmSheet
          open={asking}
          message={confirmMessage}
          confirmLabel={confirmLabel ?? (typeof children === "string" ? children : undefined)}
          tone={variant === "danger" || variant === "dangerSolid" ? "danger" : "primary"}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            confirmed.current = true;
            ref.current?.click();
          }}
        />
      )}
    </>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
  confirmMessage,
  confirmLabel,
  testId,
}: {
  children: React.ReactNode;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  value?: string;
  /** Asks the user to confirm before submitting (for irreversible actions). */
  confirmMessage?: string;
  confirmLabel?: string;
  testId?: string;
}) {
  const status = useFormStatus();
  const actionPending = useContext(PendingContext);
  const hydrated = useHydrated();
  return (
    <ConfirmableSubmit
      variant={variant}
      size={size}
      className={className}
      name={name}
      value={value}
      confirmMessage={confirmMessage}
      confirmLabel={confirmLabel}
      pending={status.pending || actionPending}
      // Stays disabled until the page is interactive, so an early click is never lost without feedback.
      disabled={!hydrated}
      testId={testId}
    >
      {children}
    </ConfirmableSubmit>
  );
}

const PendingContext = createContext(false);

/**
 * A form bound to a server action returning { error | success } message keys.
 * Submissions go through startTransition instead of the native form action so
 * React does not clear the fields: after an error the user keeps what they typed.
 * Errors stay inline next to the form; successes show as a toast, except when the
 * action returns a `detail` to copy (e.g. an invitation link), which stays visible.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  id,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useI18n();
  const toast = useToast();

  useEffect(() => {
    if (resetOnSuccess && state?.success) formRef.current?.reset();
    // The nonce changes on every successful call, so a repeated success toasts again.
    if (state?.success && !state.detail) toast(t(state.success, state.vars));
  }, [resetOnSuccess, state, toast, t]);

  return (
    <form
      id={id}
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
      {state?.success && state.detail && (
        <div className="mb-4">
          <Notice tone="success">
            {t(state.success, state.vars)}
            <span className="mt-1 block break-all font-mono text-xs">{state.detail}</span>
          </Notice>
        </div>
      )}
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

/** Submit button of a plain server-action form that asks for confirmation first. */
export function ConfirmSubmit({
  children,
  message,
  variant = "danger",
  size = "sm",
  className,
  testId,
}: {
  children: React.ReactNode;
  message: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  className?: string;
  testId?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <ConfirmableSubmit variant={variant} size={size} className={className} confirmMessage={message} pending={pending} testId={testId}>
      {children}
    </ConfirmableSubmit>
  );
}
