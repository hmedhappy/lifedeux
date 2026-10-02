"use client";

import { useState } from "react";
import clsx from "clsx";
import { Star } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { ActionForm, SubmitButton } from "./forms";
import { useI18n } from "./i18n-provider";
import { Textarea } from "./ui";

/** Star rating + optional comment, shown once the consultation is over. */
export function ReviewForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  return (
    <ActionForm action={action} className="space-y-4">
      <input type="hidden" name="rating" value={rating || ""} />
      <div className="flex gap-1" role="radiogroup" aria-label={t("review.rating")} data-testid="review-stars">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i} / 5`}
            onClick={() => setRating(i)}
            className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-amber-50"
          >
            <Star className={clsx("h-7 w-7 transition", i <= rating ? "animate-pop fill-amber-400 text-amber-400" : "text-line-strong")} aria-hidden />
          </button>
        ))}
      </div>
      <Textarea name="text" rows={3} maxLength={1000} placeholder={t("review.placeholder")} aria-label={t("review.comment")} />
      <SubmitButton testId="review-submit">{t("review.send")}</SubmitButton>
    </ActionForm>
  );
}
