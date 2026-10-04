"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Table that turns into one card per row on phones (see `.rtable` in globals.css).
 * Each cell gets its column title in `data-label`, shown above the value on small screens.
 */
export function ResponsiveTable({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLTableElement>(null);

  useLayoutEffect(() => {
    const table = ref.current;
    if (!table) return;
    const labels: string[] = [];
    table.querySelectorAll("thead tr:first-child th").forEach((th) => {
      const span = (th as HTMLTableCellElement).colSpan || 1;
      for (let i = 0; i < span; i++) labels.push(th.textContent?.trim() ?? "");
    });
    table.querySelectorAll("tbody tr").forEach((tr) => {
      let col = 0;
      for (const cell of Array.from((tr as HTMLTableRowElement).cells)) {
        cell.dataset.label = labels[col] ?? "";
        col += cell.colSpan || 1;
      }
    });
  });

  return (
    <div className="rtable overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
      <table ref={ref} className="w-full min-w-[640px] text-start text-sm">
        {children}
      </table>
    </div>
  );
}
