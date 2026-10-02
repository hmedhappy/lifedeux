"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { Button } from "./ui";

/**
 * Bottom sheet on phones, centred dialog from `md` up. Closes on Escape and on the
 * backdrop; focus moves into the sheet and back to the opener when it closes.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "full";
  testId?: string;
}) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current;
      target?.focus();
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      clearTimeout(focusTimer);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const widths = { sm: "md:max-w-sm", md: "md:max-w-lg", lg: "md:max-w-3xl", full: "md:max-w-5xl" };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        data-testid={testId}
        className={clsx(
          "relative flex max-h-[92dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-3xl bg-white shadow-sheet outline-none md:animate-modal-in md:rounded-3xl",
          widths[size],
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong md:hidden" aria-hidden />
        {title !== undefined && (
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3 md:pt-5">
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label={t("common.close")} className="-me-2 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-white px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** A confirmation step that replaces window.confirm: same colours, same languages, accessible. */
export function ConfirmSheet({
  open,
  message,
  confirmLabel,
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onCancel} title={t("common.confirmTitle")} size="sm" testId="confirm-sheet">
      <p className="text-ink-soft">{message}</p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.back")}
        </Button>
        <Button type="button" variant={tone === "danger" ? "dangerSolid" : "primary"} onClick={onConfirm} data-autofocus>
          {confirmLabel ?? t("common.confirm")}
        </Button>
      </div>
    </Sheet>
  );
}
