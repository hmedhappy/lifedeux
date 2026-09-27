"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useI18n } from "./i18n-provider";

export type SlotOption = { id: string; dayKey: string; dayLabel: string; weekday: string; time: string; full: string };

export function SlotPicker({ slots }: { slots: SlotOption[] }) {
  const { t } = useI18n();
  const days = useMemo(() => {
    const map = new Map<string, { label: string; weekday: string; slots: SlotOption[] }>();
    for (const s of slots) {
      const entry = map.get(s.dayKey) ?? { label: s.dayLabel, weekday: s.weekday, slots: [] };
      entry.slots.push(s);
      map.set(s.dayKey, entry);
    }
    return [...map.entries()];
  }, [slots]);

  const [day, setDay] = useState(days[0]?.[0]);
  const [slotId, setSlotId] = useState<string | null>(null);
  const selected = slots.find((s) => s.id === slotId);
  const current = days.find(([key]) => key === day)?.[1];

  if (slots.length === 0) {
    return <p className="rounded-xl bg-surface p-4 text-sm text-muted">{t("doctor.noSlots")}</p>;
  }

  return (
    <div>
      <input type="hidden" name="slotId" value={slotId ?? ""} />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="listbox" aria-label={t("doctor.chooseDay")}>
        {days.map(([key, d]) => (
          <button
            key={key}
            type="button"
            role="option"
            aria-selected={key === day}
            onClick={() => {
              setDay(key);
              setSlotId(null);
            }}
            className={clsx(
              "flex min-w-20 shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 text-sm transition",
              key === day ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
            )}
          >
            <span className="text-xs capitalize opacity-80">{d.weekday}</span>
            <span className="font-semibold">{d.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="slot-times">
        {current?.slots.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSlotId(s.id)}
            aria-pressed={s.id === slotId}
            className={clsx(
              "rounded-lg border px-3 py-2 text-sm font-medium transition",
              s.id === slotId ? "border-brand bg-rose-50 text-brand-dark" : "border-line hover:border-ink",
            )}
          >
            {s.time}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {selected ? t("doctor.selected", { date: selected.full }) : t("doctor.pickTime")}
      </p>
    </div>
  );
}
