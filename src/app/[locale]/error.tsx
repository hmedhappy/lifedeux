"use client";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-ink">{t("errors.genericTitle")}</h1>
      <p className="mt-2 text-muted">{t("errors.genericText")}</p>
      <Button size="lg" className="mt-8" onClick={reset}>
        {t("errors.retry")}
      </Button>
    </div>
  );
}
