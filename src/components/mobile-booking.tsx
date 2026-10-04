"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Loader2,
  MailCheck,
  MapPin,
  MessageCircle,
  Scissors,
  X,
} from "lucide-react";
import { bookAsVisitorAction, saveFavoriteAction, type VisitorInput } from "@/actions/qr";
import { requestConsultationAction, requestInPersonAction } from "@/actions/consultation";
import { useI18n } from "./i18n-provider";
import { shrink } from "./image-input";
import type { SlotOption } from "./slot-strip";
import { useToast } from "./toast";
import { Avatar, Button, Input, Notice } from "./ui";

export type BookingMode = "cabinet" | "consultation";
type Offer = { price: string; slots: SlotOption[] };
type Flow = "book" | "favorite";
type Step = "mode" | "slot" | "reason" | "photos" | "identity" | "recap" | "sent" | "saved";

const LARGE = "(min-width: 1024px)";
const REASONS = { consultation: ["first", "followUp", "results", "renewal", "pain", "question"], cabinet: ["first", "followUp", "results", "renewal"] } as const;
const MAX_PHOTOS = 3;

/**
 * Doctor page on phones: one screen with the doctor and two buttons, then a full-screen
 * stepper that slides (time, optional reason and photos, who), only taps, no scrolling.
 * Visitors give their name, email and phone; the email link confirms the booking.
 * Desktop keeps the regular page.
 */
export function MobileBooking({
  doctor,
  offers,
  initialMode,
  operationHref,
  taken,
  today,
  signedIn,
  favorite: initialFavorite,
}: {
  doctor: { id: string; name: string; photoUrl: string | null; specialty: string; address: string };
  offers: Partial<Record<BookingMode, Offer>>;
  /** From the practice QR code: straight to the practice, no choice to make. */
  initialMode: BookingMode | null;
  /** Surgery is booked from the full page; a link leads there. */
  operationHref: string | null;
  /** Appointments already taken with this doctor, per day key: dots on the calendar. */
  taken: Record<string, number>;
  today: string;
  /** A signed-in patient: no identity step, the favourite toggles at once. */
  signedIn: boolean;
  favorite: boolean;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const modes = (["cabinet", "consultation"] as const).filter((m) => offers[m]);
  const [open, setOpen] = useState(true);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [mode, setMode] = useState<BookingMode>(initialMode && offers[initialMode] ? initialMode : modes[0]);
  const [index, setIndex] = useState(0);
  const [slotId, setSlotId] = useState<string | null>(null);
  const offer = offers[mode]!;
  const [day, setDay] = useState<string | undefined>(offer.slots[0]?.dayKey);
  const [chips, setChips] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [who, setWho] = useState<VisitorInput>({ firstName: "", lastName: "", email: "", phone: "" });
  const [sentTo, setSentTo] = useState("");
  const [favorite, setFavorite] = useState(initialFavorite);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const chooseMode = flow === "book" && modes.length > 1 && !initialMode;
  const steps: Step[] =
    flow === "book"
      ? [
          ...(chooseMode ? (["mode"] as const) : []),
          "slot",
          "reason",
          ...(mode === "consultation" ? (["photos"] as const) : []),
          signedIn ? "recap" : "identity",
          "sent",
        ]
      : ["identity", "saved"];
  const step = steps[index];
  const slot = offer.slots.find((s) => s.id === slotId) ?? null;
  const times = offer.slots.filter((s) => s.dayKey === day);
  const anySlot = modes.some((m) => offers[m]!.slots.length > 0);

  // The overlay owns the screen on phones: the page behind does not scroll.
  useEffect(() => {
    if (!open || window.matchMedia(LARGE).matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  if (!open) {
    // Back on the full page: one bar to come back to the booking.
    return (
      <div className="no-print fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-30 border-t border-line bg-white/95 px-4 py-3 shadow-sheet backdrop-blur md:bottom-0 lg:hidden">
        <Button size="lg" className="w-full" onClick={() => setOpen(true)} data-testid="mobile-booking-reopen">
          <CalendarDays className="h-5 w-5" aria-hidden />
          {t("qrBook.book")}
        </Button>
      </div>
    );
  }

  function begin(next: Flow) {
    setError(null);
    if (next === "favorite" && signedIn) {
      start(async () => {
        const res = await saveFavoriteAction(locale, doctor.id);
        if (!res.ok) return toast(t(res.error), { tone: "error" });
        setFavorite(!!res.saved);
        toast(t(res.saved ? "qrBook.favoriteAdded" : "qrBook.favoriteRemoved"));
      });
      return;
    }
    setFlow(next);
    setIndex(0);
  }

  const next = () => setIndex((i) => i + 1);

  function back() {
    setError(null);
    if (index === 0) setFlow(null);
    else setIndex((i) => i - 1);
  }

  function pickMode(m: BookingMode) {
    setMode(m);
    setSlotId(null);
    setDay(offers[m]!.slots[0]?.dayKey);
    setTimeout(next, 200);
  }

  function pickTime(id: string) {
    setSlotId(id);
    // A short pause so the tap is seen, then the next slide.
    setTimeout(next, 220);
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const resized = await Promise.all([...files].slice(0, MAX_PHOTOS - photos.length).map(shrink));
    setPhotos((list) => [...list, ...resized].slice(0, MAX_PHOTOS));
    if (fileInput.current) fileInput.current.value = "";
  }

  function bookingData(): FormData {
    const data = new FormData();
    data.set("slotId", slotId ?? "");
    const labels = chips.map((c) => t(`booking.reasons.${c}`));
    const reason = [labels.join(", "), note.trim()].filter(Boolean).join(" — ");
    if (reason) data.set("reason", reason);
    if (consent) data.set("consent", "on");
    if (mode === "consultation") for (const p of photos) data.append("photos", p);
    return data;
  }

  function submitIdentity(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      let res;
      if (flow === "book") {
        const data = bookingData();
        for (const [k, v] of Object.entries(who)) data.set(k, v);
        res = await bookAsVisitorAction(locale, doctor.id, mode, data);
      } else {
        res = await saveFavoriteAction(locale, doctor.id, who);
      }
      if (!res.ok) return setError(t(res.error));
      setSentTo(res.email ?? who.email);
      if (flow === "favorite") setFavorite(true);
      next();
    });
  }

  function confirmAsPatient() {
    setError(null);
    if (mode === "consultation" && !consent) return setError(t("errors.consentRequired"));
    start(async () => {
      // A successful request redirects to the appointment; anything returned is an error.
      const action = mode === "cabinet" ? requestInPersonAction : requestConsultationAction;
      const res = await action(locale, doctor.id, undefined, bookingData());
      if (res?.error) setError(t(res.error, res.vars));
    });
  }

  function leave() {
    if (window.history.length > 1) window.history.back();
    else router.push(`/${locale}/doctors`);
  }

  const set = (k: keyof VisitorInput) => (e: React.ChangeEvent<HTMLInputElement>) => setWho((w) => ({ ...w, [k]: e.target.value }));
  const priceLine = modes.map((m) => `${t(m === "cabinet" ? "cabinet.tag" : "doctor.service.consultation")} · ${offers[m]!.price}`);
  const consentBox = mode === "consultation" && (
    <label className="flex items-start gap-3 text-sm text-ink">
      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="mt-1 h-4 w-4 accent-brand" data-testid="qr-consent" />
      <span>{t("booking.consentConsultation")}</span>
    </label>
  );

  const skipRow = (onSkip: () => void, canContinue: boolean, testId: string) => (
    <div className="mt-auto space-y-2.5 pt-4">
      <Button size="lg" className="h-14 w-full text-base" onClick={next} disabled={!canContinue} data-testid={`${testId}-next`}>
        {t("steps.next")}
      </Button>
      <Button size="lg" variant="ghost" className="h-12 w-full text-base" onClick={onSkip} data-testid={`${testId}-skip`}>
        {t("qrBook.notNow")}
      </Button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex h-dvh flex-col bg-canvas lg:hidden" role="dialog" aria-modal aria-label={doctor.name} data-testid="qr-experience">
      {flow === null ? (
        /* ---------- One screen: who, and two buttons ---------- */
        <div className="flex h-full flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <button type="button" onClick={leave} aria-label={t("common.back")} className="-ms-2 flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface" data-testid="qr-leave">
              <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 text-sm font-semibold text-brand" data-testid="qr-profile">
              {t("qrBook.fullProfile")}
            </button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="qr-rise w-full rounded-[2rem] bg-white px-6 pb-7 pt-8 shadow-float">
              <div className="flex justify-center">
                <Avatar name={doctor.name} src={doctor.photoUrl} size={104} />
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">{doctor.name}</h1>
              <p className="mt-1 font-medium text-brand">{doctor.specialty}</p>
              {doctor.address && offers.cabinet && (
                <p className="mt-3 flex items-start justify-center gap-1.5 text-sm text-muted">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{doctor.address}</span>
                </p>
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {priceLine.map((line) => (
                  <span key={line} className="inline-flex items-center rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand-dark">
                    {line}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="qr-rise space-y-2.5 [animation-delay:120ms]">
            <Button size="lg" className="h-14 w-full text-base" onClick={() => begin("book")} disabled={!anySlot} data-testid="qr-book">
              <CalendarDays className="h-5 w-5" aria-hidden />
              {anySlot ? t("qrBook.book") : t("doctor.noSlots")}
            </Button>
            <Button size="lg" variant="secondary" className="h-14 w-full text-base" onClick={() => begin("favorite")} disabled={pending} data-testid="qr-favorite">
              <Heart className={clsx("h-5 w-5", favorite && "fill-current")} aria-hidden />
              {t(favorite ? "qrBook.inFavorites" : "qrBook.favorite")}
            </Button>
            {operationHref && (
              <a href={operationHref} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-trip">
                <Scissors className="h-4 w-4" aria-hidden />
                {t("qrBook.surgery")}
              </a>
            )}
          </div>
        </div>
      ) : (
        /* ---------- Stepper: full screen, slides ---------- */
        <>
          <header className="flex items-center gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            {step !== "sent" && step !== "saved" ? (
              <button type="button" onClick={back} aria-label={t("common.back")} className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface">
                <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
              </button>
            ) : (
              <span className="w-11" />
            )}
            <div className="flex flex-1 gap-1.5" aria-hidden>
              {steps.map((s, i) => (
                <span key={s} className={clsx("h-1.5 flex-1 rounded-full transition-colors duration-500", i <= index ? "bg-brand" : "bg-line")} />
              ))}
            </div>
            <button type="button" onClick={() => (setFlow(null), setIndex(0))} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-surface">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div className="relative flex-1 overflow-hidden">
            <div className="flex h-full transition-transform duration-500 ease-[var(--ease-standard)] rtl:flex-row-reverse" style={{ transform: `translateX(-${index * 100}%)` }}>
              {steps.map((s, i) => (
                <section
                  key={s}
                  className={clsx("flex h-full w-full shrink-0 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]", i !== index && "pointer-events-none")}
                  aria-hidden={i !== index}
                  data-testid={`qr-step-${s}`}
                >
                  {s === "mode" && (
                    <>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">{t("qrBook.modeTitle")}</h2>
                      <div className="mt-6 space-y-3">
                        {modes.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => pickMode(m)}
                            className={clsx(
                              "flex w-full items-center gap-4 rounded-3xl border bg-white p-5 text-start transition active:scale-[0.98]",
                              m === mode && slotId ? "border-brand ring-1 ring-brand" : "border-line",
                            )}
                            data-testid={`qr-mode-${m}`}
                          >
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                              {m === "cabinet" ? <Building2 className="h-6 w-6" aria-hidden /> : <MessageCircle className="h-6 w-6" aria-hidden />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-lg font-semibold text-ink">{t(m === "cabinet" ? "cabinet.tag" : "doctor.service.consultation")}</span>
                              <span className="block text-sm text-muted">{t(m === "cabinet" ? "qrBook.modeCabinetHint" : "qrBook.modeOnlineHint")}</span>
                            </span>
                            <span className="text-lg font-bold text-ink">{offers[m]!.price}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {s === "slot" && (
                    <>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">{t(mode === "cabinet" ? "qrBook.whenTitle" : "qrBook.whenOnlineTitle")}</h2>
                      <MonthCalendar key={mode} slots={offer.slots} taken={taken} today={today} value={day} onChange={setDay} />
                      <div className="mt-3 grid flex-1 auto-rows-min grid-cols-4 gap-2 overflow-y-auto pb-2" data-testid="qr-times">
                        {times.map((sl) => (
                          <button
                            key={sl.id}
                            type="button"
                            onClick={() => pickTime(sl.id)}
                            className={clsx(
                              "h-12 rounded-xl border text-base font-semibold transition active:scale-95",
                              sl.id === slotId ? "border-brand bg-brand text-white" : "border-line bg-white text-ink",
                            )}
                          >
                            {sl.time}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {s === "reason" && (
                    <>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">{t("qrBook.reasonTitle")}</h2>
                      <p className="mt-1 text-muted">{t("qrBook.reasonText")}</p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {REASONS[mode].map((r) => {
                          const on = chips.includes(r);
                          return (
                            <button
                              key={r}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setChips((list) => (on ? list.filter((x) => x !== r) : [...list, r]))}
                              className={clsx(
                                "min-h-11 rounded-full border px-4 text-base transition active:scale-95",
                                on ? "border-brand bg-brand text-white" : "border-line bg-white text-ink",
                              )}
                            >
                              {t(`booking.reasons.${r}`)}
                            </button>
                          );
                        })}
                      </div>
                      <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t("qrBook.reasonNote")} aria-label={t("qrBook.reasonNote")} className="mt-4" />
                      {skipRow(() => (setChips([]), setNote(""), next()), chips.length > 0 || note.trim().length > 0, "qr-reason")}
                    </>
                  )}

                  {s === "photos" && (
                    <>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">{t("qrBook.photosTitle")}</h2>
                      <p className="mt-1 text-muted">{t("qrBook.photosText")}</p>
                      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} data-testid="qr-photos" />
                      <div className="mt-5 grid grid-cols-3 gap-2.5">
                        {previews.map((src, j) => (
                          <span key={src} className="relative aspect-square">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" className="h-full w-full rounded-2xl object-cover" />
                            <button
                              type="button"
                              onClick={() => setPhotos((list) => list.filter((_, k) => k !== j))}
                              aria-label={t("rx.remove")}
                              className="absolute -end-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white"
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </button>
                          </span>
                        ))}
                        {photos.length < MAX_PHOTOS && (
                          <button
                            type="button"
                            onClick={() => fileInput.current?.click()}
                            className={clsx(
                              "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-white text-sm font-semibold text-ink-soft",
                              photos.length === 0 ? "col-span-3 h-40" : "aspect-square",
                            )}
                          >
                            <Camera className="h-7 w-7 text-brand" aria-hidden />
                            {photos.length === 0 && t("booking.addPhotos")}
                          </button>
                        )}
                      </div>
                      {skipRow(() => (setPhotos([]), next()), photos.length > 0, "qr-photos")}
                    </>
                  )}

                  {(s === "identity" || s === "recap") && (
                    <form onSubmit={(e) => (s === "recap" ? (e.preventDefault(), confirmAsPatient()) : submitIdentity(e))} className="flex h-full flex-col">
                      <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">
                        {t(s === "recap" ? "qrBook.recapTitle" : flow === "book" ? "qrBook.whoTitle" : "qrBook.favoriteTitle")}
                      </h2>
                      {flow === "book" && slot && (
                        <p className="mt-2 flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
                          <CalendarCheck className="h-5 w-5 shrink-0" aria-hidden />
                          <span className="first-letter:uppercase">
                            {slot.full} · {t(mode === "cabinet" ? "cabinet.tag" : "doctor.service.consultation")}
                          </span>
                        </p>
                      )}
                      {flow === "favorite" && <p className="mt-1 text-muted">{t("qrBook.favoriteText", { doctor: doctor.name })}</p>}
                      {s === "identity" && (
                        <div className="mt-5 space-y-3">
                          <div className="grid grid-cols-2 gap-2.5">
                            <Input name="firstName" value={who.firstName} onChange={set("firstName")} placeholder={t("fields.firstName")} aria-label={t("fields.firstName")} autoComplete="given-name" required data-testid="qr-first-name" />
                            <Input name="lastName" value={who.lastName} onChange={set("lastName")} placeholder={t("fields.lastName")} aria-label={t("fields.lastName")} autoComplete="family-name" required data-testid="qr-last-name" />
                          </div>
                          <Input type="email" name="email" value={who.email} onChange={set("email")} placeholder={t("fields.email")} aria-label={t("fields.email")} autoComplete="email" inputMode="email" required data-testid="qr-email" />
                          <Input type="tel" name="phone" value={who.phone} onChange={set("phone")} placeholder={t("fields.phone")} aria-label={t("fields.phone")} autoComplete="tel" inputMode="tel" required data-testid="qr-phone" />
                          <p className="text-xs text-muted">{t("fields.latinHint")}</p>
                        </div>
                      )}
                      {s === "recap" && mode === "cabinet" && <p className="mt-4 text-sm text-muted">{t("cabinet.payThere")}</p>}
                      <div className="mt-auto space-y-3 pt-4">
                        {flow === "book" && consentBox}
                        {error && <Notice tone="error">{error}</Notice>}
                        <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={pending} data-testid="qr-submit">
                          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
                          {t(flow === "book" ? (mode === "cabinet" ? "qrBook.confirm" : "qrBook.confirmOnline") : "qrBook.saveFavorite")}
                        </Button>
                        {s === "identity" && <p className="text-center text-xs text-muted">{t(flow === "book" ? (mode === "cabinet" ? "qrBook.bookFootnote" : "qrBook.bookOnlineFootnote") : "qrBook.favoriteFootnote")}</p>}
                      </div>
                    </form>
                  )}

                  {(s === "sent" || s === "saved") && (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <span className={clsx("flex h-24 w-24 items-center justify-center rounded-full bg-brand-soft text-brand", i === index && "qr-pop")}>
                        {s === "sent" ? <MailCheck className="h-11 w-11" aria-hidden /> : <Check className="h-11 w-11" aria-hidden />}
                      </span>
                      <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink">{t(s === "sent" ? "qrBook.sentTitle" : "qrBook.savedTitle")}</h2>
                      <p className="mt-2 max-w-xs text-muted">{t(s === "sent" ? "qrBook.sentText" : "qrBook.savedText", { email: sentTo })}</p>
                      <Button variant="secondary" size="lg" className="mt-8 w-full max-w-xs" onClick={() => (setFlow(null), setIndex(0))}>
                        {t("common.close")}
                      </Button>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const intlLocale = { fr: "fr-FR", en: "en-GB", ar: "ar-TN-u-nu-latn" } as const;
const MAX_DOTS = 3;

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Monday-first grid of the month; null cells pad the weeks. */
function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

/**
 * Month calendar, as in the doctor's agenda: days with a free time can be tapped; dots
 * under a day show the appointments already taken with this doctor that day.
 */
function MonthCalendar({
  slots,
  taken,
  today,
  value,
  onChange,
}: {
  slots: SlotOption[];
  taken: Record<string, number>;
  today: string;
  value: string | undefined;
  onChange: (day: string) => void;
}) {
  const { t, locale } = useI18n();
  const freeDays = useMemo(() => new Set(slots.map((s) => s.dayKey)), [slots]);
  const first = slots[0]?.dayKey ?? today;
  const last = slots[slots.length - 1]?.dayKey ?? today;
  const [month, setMonth] = useState((value ?? first).slice(0, 7));
  const fmt = (opts: Intl.DateTimeFormatOptions, key: string) =>
    new Intl.DateTimeFormat(intlLocale[locale], { timeZone: "UTC", ...opts }).format(new Date(`${key}T12:00:00Z`));

  return (
    <div className="mt-3" data-testid="qr-calendar">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          disabled={month <= today.slice(0, 7)}
          aria-label={t("slots.prevMonth")}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface disabled:opacity-25"
        >
          <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
        </button>
        <p className="text-base font-semibold capitalize text-ink" aria-live="polite">
          {fmt({ month: "long", year: "numeric" }, `${month}-01`)}
        </p>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= last.slice(0, 7)}
          aria-label={t("slots.nextMonth")}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface disabled:opacity-25"
          data-testid="qr-next-month"
        >
          <ChevronRight className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-0.5 text-center" role="grid" aria-label={t("doctor.chooseDay")}>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="pb-1 text-[11px] font-medium uppercase text-muted" role="columnheader">
            {fmt({ weekday: "narrow" }, `2024-01-0${i + 1}`)}
          </span>
        ))}
        {monthGrid(month).map((key, i) => {
          if (!key) return <span key={`b${i}`} aria-hidden />;
          const free = freeDays.has(key);
          const busy = taken[key] ?? 0;
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              disabled={!free}
              aria-selected={selected}
              onClick={() => onChange(key)}
              aria-label={fmt({ weekday: "long", day: "numeric", month: "long" }, key)}
              className="flex h-11 flex-col items-center justify-center"
              data-day={key}
            >
              <span
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm tabular-nums transition",
                  selected ? "bg-brand font-bold text-white" : free ? "font-semibold text-ink" : "text-line-strong",
                  key === today && !selected && "ring-1 ring-brand",
                )}
              >
                {Number(key.slice(8))}
              </span>
              <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                {Array.from({ length: Math.min(busy, MAX_DOTS) }, (_, j) => (
                  <span key={j} className={clsx("h-1 w-1 rounded-full", selected ? "bg-brand" : "bg-accent")} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        {t("qrBook.takenLegend")}
      </p>
    </div>
  );
}
