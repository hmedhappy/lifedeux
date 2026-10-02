"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { ActionForm, SubmitButton } from "./forms";
import { useI18n } from "./i18n-provider";
import { Sheet } from "./overlay";
import { SlotStrip, type SlotOption } from "./slot-strip";
import { Button } from "./ui";

/** "Changer d'horaire": the patient picks another free slot; the doctor approves it. */
export function RescheduleSheet({
  slots,
  action,
}: {
  slots: SlotOption[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [slotId, setSlotId] = useState<string | null>(null);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} data-testid="reschedule-open">
        <CalendarClock className="h-4 w-4" aria-hidden />
        {t("consult.reschedule")}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("consult.reschedule")} size="md" testId="reschedule-sheet">
        <ActionForm
          action={async (state, data) => {
            const res = await action(state, data);
            if (res?.success) setOpen(false);
            return res;
          }}
          className="space-y-4"
        >
          <p className="text-sm text-muted">{t("consult.rescheduleHint")}</p>
          <SlotStrip slots={slots} value={slotId} onChange={setSlotId} />
          <SubmitButton size="lg" className="w-full" testId="reschedule-submit">
            {t("consult.rescheduleSend")}
          </SubmitButton>
        </ActionForm>
      </Sheet>
    </>
  );
}
