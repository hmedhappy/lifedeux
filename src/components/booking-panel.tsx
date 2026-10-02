"use client";

import { useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { Camera, Loader2, X } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { AuthPanel } from "./auth-panel";
import { useI18n } from "./i18n-provider";
import { shrink } from "./image-input";
import { Sheet } from "./overlay";
import { SlotStrip, type SlotOption } from "./slot-strip";
import { Button, Field, Input, Notice, Select, Textarea } from "./ui";

const REASONS = ["first", "followUp", "results", "renewal", "pain", "question"] as const;
const MAX_PHOTOS = 3;

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Booking form of a doctor page. A visitor chooses everything first; the sign-in
 * (email code or Google) happens in a sheet at the end, and the request is then sent.
 */
export function BookingPanel({
  service,
  slots,
  action,
  signedIn,
  isPatient,
  googleEnabled,
  operations,
  needsContact,
  next,
}: {
  service: "consultation" | "operation";
  slots: SlotOption[];
  action: Action;
  signedIn: boolean;
  isPatient: boolean;
  googleEnabled: boolean;
  operations?: { id: string; label: string }[];
  /** Surgery needs a phone and a country; asked only if the account has none. */
  needsContact?: boolean;
  next: string;
}) {
  const { t } = useI18n();
  const [slotId, setSlotId] = useState<string | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auth, setAuth] = useState(false);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (signedIn && !isPatient) {
    return <Notice tone="info">{t("doctor.patientsOnly")}</Notice>;
  }

  function buildData(): FormData | null {
    if (!form.current) return null;
    const data = new FormData(form.current);
    if (service === "consultation") {
      const labels = chips.map((c) => t(`booking.reasons.${c}`));
      data.set("reason", [labels.join(", "), text.trim()].filter(Boolean).join(" — "));
      data.delete("photos");
      for (const p of photos) data.append("photos", p);
    }
    return data;
  }

  function send() {
    const data = buildData();
    if (!data) return;
    start(async () => {
      const res = await action(undefined, data);
      // A successful request redirects; anything returned here is an error.
      if (res?.error) setError(t(res.error, res.vars));
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!slotId) return setError(t("errors.chooseSlot"));
    if (!consent) return setError(t("errors.consentRequired"));
    if (!signedIn) return setAuth(true);
    send();
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const resized = await Promise.all([...files].slice(0, MAX_PHOTOS - photos.length).map(shrink));
    setPhotos((list) => [...list, ...resized].slice(0, MAX_PHOTOS));
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <form ref={form} onSubmit={submit} className="space-y-5" data-testid={`booking-${service}`}>
      {service === "operation" && operations && operations.length > 1 && (
        <Field label={t("doctor.operation")}>
          <Select name="operationId" required>
            {operations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {service === "operation" && operations?.length === 1 && <input type="hidden" name="operationId" value={operations[0].id} />}

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">{t("doctor.chooseSlot")}</p>
        <SlotStrip slots={slots} value={slotId} onChange={setSlotId} />
      </div>

      {service === "consultation" ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-ink">{t("doctor.reason")}</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => {
              const on = chips.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChips((list) => (on ? list.filter((x) => x !== r) : [...list, r]))}
                  className={clsx(
                    "min-h-9 rounded-full border px-3 text-sm transition",
                    on ? "border-brand bg-brand-soft font-semibold text-brand-dark" : "border-line bg-white text-ink-soft hover:border-brand",
                  )}
                >
                  {t(`booking.reasons.${r}`)}
                </button>
              );
            })}
          </div>
          <Textarea
            name="reasonText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={900}
            rows={2}
            placeholder={t("doctor.reasonPlaceholder")}
            aria-label={t("doctor.reason")}
          />
          <div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} data-testid="booking-photos" />
            <div className="flex flex-wrap items-center gap-2">
              {photos.map((p, i) => (
                <span key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(p)} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                    aria-label={t("rx.remove")}
                    className="absolute -end-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 text-sm font-medium text-ink-soft hover:border-brand">
                  <Camera className="h-4 w-4" aria-hidden />
                  {t("booking.addPhotos")}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">{t("booking.photosHint")}</p>
          </div>
        </div>
      ) : (
        <>
          {needsContact && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("fields.phone")} hint={t("fields.phoneHint")}>
                <Input type="tel" name="phone" autoComplete="tel" required />
              </Field>
              <Field label={t("fields.country")}>
                <Input name="country" autoComplete="country-name" required />
              </Field>
            </div>
          )}
          <Field label={t("doctor.note")} hint={t("doctor.noteHint")}>
            <Textarea name="note" maxLength={1000} rows={3} />
          </Field>
        </>
      )}

      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-brand" data-testid="booking-consent" />
        <span>{t(service === "consultation" ? "booking.consentConsultation" : "booking.consentSurgery")}</span>
      </label>

      {error && <Notice tone="error">{error}</Notice>}

      <Button type="submit" size="lg" className="w-full" disabled={pending} data-testid="booking-submit">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {service === "consultation" ? t("doctor.requestConsult") : t("doctor.requestButton")}
      </Button>
      <p className="text-center text-xs text-muted">{t(service === "consultation" ? "booking.policyConsultation" : "doctor.noChargeYet")}</p>

      <Sheet open={auth} onClose={() => setAuth(false)} title={t("booking.signInTitle")} size="sm">
        <AuthPanel
          next={next}
          googleEnabled={googleEnabled}
          intro={t("booking.signInIntro")}
          onSignedIn={() => {
            setAuth(false);
            send();
          }}
        />
      </Sheet>
    </form>
  );
}
