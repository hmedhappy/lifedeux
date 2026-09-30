"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone; action?: { label: string; onClick: () => void }; duration: number };
type ToastFn = (message: string, options?: { tone?: Tone; action?: Toast["action"]; duration?: number }) => void;

const ToastContext = createContext<ToastFn>(() => {});

/** Short, non-blocking feedback ("Enregistré", "Demande acceptée · Annuler"). */
export function useToast(): ToastFn {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback<ToastFn>((message, options = {}) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, message, tone: options.tone ?? "success", action: options.action, duration: options.duration ?? 4000 }]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-[70] flex flex-col items-center gap-2 px-4 md:top-auto md:bottom-6 md:items-end"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, toast.duration);
    return () => clearTimeout(id);
  }, [toast.duration, onDone]);
  const Icon = toast.tone === "error" ? AlertCircle : toast.tone === "info" ? Info : CheckCircle2;
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-sheet"
    >
      <Icon className={clsx("h-5 w-5 shrink-0", toast.tone === "error" ? "text-red-300" : "text-emerald-300")} aria-hidden />
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDone();
          }}
          className="shrink-0 rounded-lg px-2 py-1 font-semibold text-emerald-300 hover:bg-white/10"
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" onClick={onDone} aria-label="×" className="shrink-0 rounded-lg p-1 text-white/60 hover:bg-white/10">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
