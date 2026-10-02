"use client";

import { useState } from "react";
import { useI18n } from "./i18n-provider";
import { Sheet } from "./overlay";
import { Button } from "./ui";

/**
 * Phones: a bar fixed above the tab bar with the price, the next slot and one button;
 * the booking form opens in a sheet. Hidden from `lg`, where the form sits in the sidebar.
 */
export function BookingBar({
  price,
  nextSlot,
  label,
  title,
  children,
}: {
  price: string;
  nextSlot: string | null;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="h-24 lg:hidden" aria-hidden />
      <div className="booking-bar no-print fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-30 border-t border-line bg-white/95 px-4 py-3 shadow-sheet backdrop-blur md:bottom-0 lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-tight text-ink">{price}</p>
            <p className="truncate text-xs text-muted">{nextSlot ? t("doctor.nextSlot", { date: nextSlot }) : t("doctor.noSlots")}</p>
          </div>
          <Button type="button" size="lg" onClick={() => setOpen(true)} data-testid="booking-open">
            {label}
          </Button>
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} size="lg">
        {children}
      </Sheet>
    </>
  );
}
