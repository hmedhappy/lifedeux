import Link from "next/link";
import clsx from "clsx";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, type LucideIcon } from "lucide-react";

export type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerSolid" | "dark" | "soft";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-card hover:bg-brand-dark disabled:opacity-50",
  secondary: "border border-line-strong bg-white text-ink hover:border-ink hover:bg-surface disabled:opacity-50",
  ghost: "text-ink hover:bg-surface disabled:opacity-50",
  soft: "bg-brand-soft text-brand-dark hover:bg-brand-soft/70 disabled:opacity-50",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50",
  dangerSolid: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  dark: "bg-ink text-white hover:bg-black disabled:opacity-50",
};

const sizes = {
  sm: "min-h-9 px-3 py-1.5 text-sm rounded-xl",
  md: "min-h-11 px-5 py-2.5 text-sm rounded-xl",
  lg: "min-h-12 px-6 py-3 text-base rounded-2xl",
};

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", extra?: string) {
  return clsx(
    "inline-flex select-none items-center justify-center gap-2 font-semibold transition duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// 16px on phones so iOS does not zoom into the field.
const fieldBase =
  "w-full min-h-11 rounded-xl border border-line-strong bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-muted transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 md:text-sm";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(fieldBase, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(fieldBase, "appearance-auto", className)} {...props} />;
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx("rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6", className)}>{children}</div>;
}

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10", className)}>{children}</div>;
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Empty list: an outline icon, one human sentence and, when useful, the next action. */
export function EmptyState({
  title,
  text,
  action,
  icon: Icon = Info,
}: {
  title: string;
  text?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-12 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand" aria-hidden>
        <Icon className="h-7 w-7" strokeWidth={1.6} />
      </span>
      <p className="mt-4 text-lg font-semibold text-ink">{title}</p>
      {text && <p className="mx-auto mt-1.5 max-w-md text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export type BadgeTone = "gray" | "green" | "amber" | "red" | "blue" | "rose" | "brand" | "trip";

export function Badge({ tone = "gray", children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
  const tones: Record<BadgeTone, string> = {
    gray: "bg-surface text-ink-soft",
    green: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    blue: "bg-sky-50 text-sky-800",
    rose: "bg-coral-soft text-coral-ink",
    brand: "bg-brand-soft text-brand-dark",
    trip: "bg-trip-soft text-trip",
  };
  return (
    <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Green dot that pulses while something is live (a chat open right now). */
export function LiveDot() {
  return <span className="inline-block h-2 w-2 animate-live rounded-full bg-emerald-600" aria-hidden />;
}

export function Avatar({ name, src, size = 56 }: { name: string; src?: string | null; size?: number }) {
  const initials = name
    .replace(/^Dr\.?\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-dark"
      style={{ width: size, height: size, fontSize: size / 2.8 }}
    >
      {initials}
    </span>
  );
}

export function Stat({ label, value, hint, icon: Icon }: { label: string; value: React.ReactNode; hint?: string; icon?: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <p className="flex items-center gap-2 text-sm text-muted">
        {Icon && <Icon className="h-4 w-4" aria-hidden />}
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "error"; children: React.ReactNode }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
  };
  const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: AlertCircle };
  const Icon = icons[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={clsx("flex gap-3 rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Placeholder block while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-shimmer rounded-xl bg-surface", className)} aria-hidden />;
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
      <table className="w-full min-w-[640px] text-start text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={clsx("border-b border-line bg-surface px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={clsx("border-b border-line px-4 py-3 align-top text-ink", className)}>{children}</td>;
}

/** "Plus d'options": optional content folded away until asked for. */
export function Disclosure({
  summary,
  children,
  className,
  defaultOpen,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className={clsx("group", className)} open={defaultOpen}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" className="h-4 w-4 transition group-open:rotate-90 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
        {summary}
      </summary>
      <div className="pb-2 pt-1">{children}</div>
    </details>
  );
}
