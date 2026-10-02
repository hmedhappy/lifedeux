"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { Button } from "./ui";

/**
 * Splits one long form into steps. Every step stays in the form (only hidden), so the
 * whole form is submitted at the end; "Continuer" checks the current step's fields first.
 */
export function StepFields({ steps, submit }: { steps: { title: string; content: React.ReactNode }[]; submit: React.ReactNode }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLFieldSetElement | null)[]>([]);
  const last = step === steps.length - 1;

  function next() {
    const fields = refs.current[step]?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea");
    for (const f of fields ?? []) if (!f.reportValidity()) return;
    setStep((s) => s + 1);
  }

  return (
    <div className="space-y-5">
      <ol className="flex gap-2" aria-label={t("steps.progress")}>
        {steps.map((s, i) => (
          <li key={s.title} className="flex-1">
            <span className={clsx("block h-1.5 rounded-full", i <= step ? "bg-brand" : "bg-line")} aria-hidden />
            <span className={clsx("mt-1.5 block text-xs font-medium", i === step ? "text-ink" : "text-muted")}>
              {i + 1}. {s.title}
            </span>
          </li>
        ))}
      </ol>
      {steps.map((s, i) => (
        <fieldset key={s.title} ref={(el) => void (refs.current[i] = el)} className={clsx("space-y-4", i !== step && "hidden")} data-testid={`step-${i + 1}`}>
          {s.content}
        </fieldset>
      ))}
      <div className="flex gap-2">
        {step > 0 && (
          <Button type="button" variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)} aria-label={t("common.back")}>
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </Button>
        )}
        {last ? (
          <div className="flex-1">{submit}</div>
        ) : (
          <Button type="button" size="lg" className="flex-1" onClick={next} data-testid="step-next">
            {t("steps.next")}
          </Button>
        )}
      </div>
    </div>
  );
}
