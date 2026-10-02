"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CornerDownLeft, Search } from "lucide-react";
import { useI18n } from "./i18n-provider";

type Command = { label: string; href: string; group?: string };
type Hit = { label: string; sub: string; href: string };

/** ⌘K / Ctrl+K: jump to any page, or find a patient, a doctor or a reference. */
export function CommandPalette({ commands, search }: { commands: Command[]; search?: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    if (!search || q.trim().length < 2) return;
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`).catch(() => null);
      if (res?.ok) setHits(((await res.json()) as { results: Hit[] }).results);
    }, 200);
    return () => clearTimeout(timer);
  }, [q, search, locale]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pages = commands.filter((c) => !needle || c.label.toLowerCase().includes(needle)).map((c) => ({ label: c.label, sub: c.group ?? "", href: c.href }));
    return [...pages, ...(needle.length >= 2 ? hits : [])];
  }, [commands, hits, q]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    setHits([]);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex min-h-10 w-full items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm text-muted hover:border-line-strong"
        data-testid="palette-open"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="flex-1 text-start">{t("palette.search")}</span>
        <kbd className="rounded-md bg-surface px-1.5 font-mono text-[11px]">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-[65] flex items-start justify-center bg-ink/40 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("palette.search")}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg animate-modal-in overflow-hidden rounded-3xl bg-white shadow-sheet"
            data-testid="palette"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="h-5 w-5 text-muted" aria-hidden />
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIndex((i) => Math.min(items.length - 1, i + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIndex((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter" && items[index]) go(items[index].href);
                }}
                placeholder={t(search ? "palette.placeholderSearch" : "palette.placeholder")}
                className="min-h-14 flex-1 bg-transparent text-base outline-none"
                data-testid="palette-input"
              />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto py-2" role="listbox">
              {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">{t("palette.none")}</li>}
              {items.map((item, i) => (
                <li key={`${item.href}-${i}`} role="option" aria-selected={i === index}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => go(item.href)}
                    className={clsx("flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm", i === index && "bg-brand-soft")}
                    data-testid="palette-item"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{item.label}</span>
                      {item.sub && <span className="block truncate text-xs text-muted">{item.sub}</span>}
                    </span>
                    {i === index && <CornerDownLeft className="h-4 w-4 text-muted" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
