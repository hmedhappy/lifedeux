"use client";

import { useState } from "react";
import { CalendarCheck, CreditCard, FileSignature, Info, MessagesSquare, Plane, QrCode, Scissors, Search } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { Sheet } from "./overlay";

/** "Comment ça marche": a sheet that opens on tap (the old hover tooltip did not work on phones). */
export function HowItWorksButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const consult = [Search, CalendarCheck, MessagesSquare, FileSignature];
  const surgery = [Scissors, CalendarCheck, CreditCard, Plane, QrCode];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nav.howItWorks")}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition hover:bg-surface"
        data-testid="how-it-works"
      >
        <Info className="h-5 w-5" aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("nav.howItWorks")} size="lg">
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { title: t("home.consultTrack.title"), icons: consult, key: "consultSteps" },
            { title: t("home.surgeryTrack.title"), icons: surgery, key: "steps" },
          ].map((track) => (
            <section key={track.key}>
              <h3 className="font-semibold text-ink">{track.title}</h3>
              <ol className="mt-3 space-y-3">
                {track.icons.map((Icon, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{t(`home.${track.key}.${i + 1}.title`)}</span>
                      <span className="block text-sm text-muted">{t(`home.${track.key}.${i + 1}.text`)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </Sheet>
    </>
  );
}
