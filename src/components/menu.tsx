"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

/** Small dropdown that closes on outside click, Escape and after choosing an item. */
export function Dropdown({
  trigger,
  label,
  children,
  align = "end",
  width = "w-60",
  testId,
}: {
  trigger: React.ReactNode;
  label: string;
  children: React.ReactNode;
  align?: "start" | "end";
  width?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        data-testid={testId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center rounded-full transition hover:bg-surface"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          onClick={(e) => {
            // Close after the click is handled: removing a form synchronously would cancel its submission.
            if ((e.target as HTMLElement).closest("a,button[type=submit]")) setTimeout(() => setOpen(false), 0);
          }}
          className={clsx(
            "absolute z-50 mt-2 animate-modal-in overflow-hidden rounded-2xl border border-line bg-white py-2 shadow-sheet",
            align === "end" ? "end-0" : "start-0",
            width,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuLink({ href, children, strong }: { href: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <a href={href} className={clsx("flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface", strong && "font-semibold")}>
      {children}
    </a>
  );
}
