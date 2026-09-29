"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "./i18n-provider";

export function CopyButton({ value }: { value: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard?.writeText(value).catch(() => undefined);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
    >
      {done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {done ? t("common.copied") : t("common.copy")}
    </button>
  );
}
