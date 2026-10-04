"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { ArrowLeft, CalendarCheck, CalendarDays, Check, Heart, Loader2, MailCheck, MapPin, X } from "lucide-react";
import { bookInPersonAsVisitorAction, saveFavoriteAction, type VisitorInput } from "@/actions/qr";
import { requestInPersonAction } from "@/actions/consultation";
import { MedelysLogo } from "./brand-logo";
import { useI18n } from "./i18n-provider";
import type { SlotOption } from "./slot-strip";
import { useToast } from "./toast";
import { Avatar, Button, Input, Notice } from "./ui";

type Flow = "book" | "favorite";
type Step = "slot" | "identity" | "recap" | "sent" | "saved";

const LARGE = "(min-width: 1024px)";

/**
 * Phones, from the practice QR code: one screen with the doctor and two buttons, then a
 * full-screen stepper that slides from step to step (only taps, no scrolling).
 * Visitors give their name, email and phone; the email link confirms the booking.
 */
export function QrExperience({
  doctor,
  slots,
  signedIn,
  favorite: initialFavorite,
}: {
  doctor: { id: string; name: string; photoUrl: string | null; specialty: string; address: string; price: string };
  slots: SlotOption[];
  /** A signed-in patient: no identity step, the favorite toggles at once. */
  signedIn: boolean;
  favorite: boolean;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [index, setIndex] = useState(0);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [day, setDay] = useState<string | undefined>(slots[0]?.dayKey);
  const [who, setWho] = useState<VisitorInput>({ firstName: "", lastName: "", email: "", phone: "" });
  const [sentTo, setSentTo] = useState("");
  const [favorite, setFavorite] = useState(initialFavorite);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const steps: Step[] = flow === "book" ? ["slot", signedIn ? "recap" : "identity", "sent"] : ["identity", "saved"];
  const step = steps[index];
  const slot = slots.find((s) => s.id === slotId) ?? null;
  const days = useMemo(() => {
    const seen = new Map<string, SlotOption>();
    for (const s of slots) if (!seen.has(s.dayKey)) seen.set(s.dayKey, s);
    return [...seen.values()].slice(0, 14);
  }, [slots]);
  const times = slots.filter((s) => s.dayKey === day);

  // The overlay owns the screen on phones: the page behind does not scroll.
  useEffect(() => {
    if (!open || window.matchMedia(LARGE).matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

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

  function back() {
    setError(null);
    if (index === 0) setFlow(null);
    else setIndex((i) => i - 1);
  }

  function pickTime(id: string) {
    setSlotId(id);
    // A short pause so the tap is seen, then the next slide.
    setTimeout(() => setIndex(1), 220);
  }

  function submitIdentity(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = flow === "book" ? await bookInPersonAsVisitorAction(locale, doctor.id, slotId ?? "", who) : await saveFavoriteAction(locale, doctor.id, who);
      if (!res.ok) return setError(t(res.error));
      setSentTo(res.email ?? who.email);
      if (flow === "favorite") setFavorite(true);
      setIndex((i) => i + 1);
    });
  }

  function confirmAsPatient() {
    if (!slotId) return;
    setError(null);
    const data = new FormData();
    data.set("slotId", slotId);
    start(async () => {
      // A successful request redirects to the appointment; anything returned is an error.
      const res = await requestInPersonAction(locale, doctor.id, undefined, data);
      if (res?.error) setError(t(res.error, res.vars));
    });
  }

  const set = (k: keyof VisitorInput) => (e: React.ChangeEvent<HTMLInputElement>) => setWho((w) => ({ ...w, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-[70] flex h-dvh flex-col bg-canvas lg:hidden" role="dialog" aria-modal aria-label={doctor.name} data-testid="qr-experience">
      {flow === null ? (
        /* ---------- One screen: who, and two buttons ---------- */
        <div className="flex h-full flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <MedelysLogo className="h-7 w-auto" />
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-brand" data-testid="qr-profile">
              {t("qrBook.fullProfile")}
            </button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="qr-rise rounded-[2rem] bg-white px-6 pb-7 pt-8 shadow-float">
              <div className="flex justify-center">
                <Avatar name={doctor.name} src={doctor.photoUrl} size={104} />
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">{doctor.name}</h1>
              <p className="mt-1 font-medium text-brand">{doctor.specialty}</p>
              {doctor.address && (
                <p className="mt-3 flex items-start justify-center gap-1.5 text-sm text-muted">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{doctor.address}</span>
                </p>
              )}
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand-dark">
                {t("cabinet.tag")} · {doctor.price}
              </p>
            </div>
          </div>
          <div className="qr-rise space-y-2.5 [animation-delay:120ms]">
            <Button size="lg" className="h-14 w-full text-base" onClick={() => begin("book")} disabled={slots.length === 0} data-testid="qr-book">
              <CalendarDays className="h-5 w-5" aria-hidden />
              {slots.length ? t("qrBook.book") : t("doctor.noSlots")}
            </Button>
            <Button size="lg" variant="secondary" className="h-14 w-full text-base" onClick={() => begin("favorite")} disabled={pending} data-testid="qr-favorite">
              <Heart className={clsx("h-5 w-5", favorite && "fill-current")} aria-hidden />
              {t(favorite ? "qrBook.inFavorites" : "qrBook.favorite")}
            </Button>
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
            <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-surface">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div className="relative flex-1 overflow-hidden">
            <div
              className="flex h-full transition-transform duration-500 ease-[var(--ease-standard)] rtl:flex-row-reverse"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {steps.map((s, i) => (
                <section
                  key={s}
                  className={clsx("flex h-full w-full shrink-0 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]", i !== index && "pointer-events-none")}
                  aria-hidden={i !== index}
                  data-testid={`qr-step-${s}`}
                >
                  {s === "slot" && (
                    <>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">{t("qrBook.whenTitle")}</h2>
                      <p className="mt-1 text-muted">{doctor.name}</p>
                      <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1" role="listbox" aria-label={t("doctor.chooseDay")}>
                        {days.map((d) => (
                          <button
                            key={d.dayKey}
                            type="button"
                            role="option"
                            aria-selected={d.dayKey === day}
                            onClick={() => setDay(d.dayKey)}
                            className={clsx(
                              "flex min-w-16 shrink-0 flex-col items-center rounded-2xl border px-3 py-2.5 transition",
                              d.dayKey === day ? "border-brand bg-brand text-white" : "border-line bg-white text-ink",
                            )}
                          >
                            <span className="text-xs font-medium uppercase opacity-80">{d.weekday}</span>
                            <span className="text-base font-bold">{d.dayLabel}</span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-5 grid flex-1 auto-rows-min grid-cols-3 gap-2.5 overflow-y-auto pb-2" data-testid="qr-times">
                        {times.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => pickTime(s.id)}
                            className={clsx(
                              "h-14 rounded-2xl border text-base font-semibold transition active:scale-95",
                              s.id === slotId ? "border-brand bg-brand text-white" : "border-line bg-white text-ink",
                            )}
                          >
                            {s.time}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {(s === "identity" || s === "recap") && (
                    <form onSubmit={submitIdentity} className="flex h-full flex-col">
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">
                        {t(s === "recap" ? "qrBook.recapTitle" : flow === "book" ? "qrBook.whoTitle" : "qrBook.favoriteTitle")}
                      </h2>
                      {flow === "book" && slot && (
                        <p className="mt-2 flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
                          <CalendarCheck className="h-5 w-5 shrink-0" aria-hidden />
                          <span className="first-letter:uppercase">{slot.full}</span>
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
                      {s === "recap" && (
                        <p className="mt-4 text-sm text-muted">
                          {t("cabinet.payThere")}
                        </p>
                      )}
                      <div className="mt-auto space-y-3 pt-4">
                        {error && <Notice tone="error">{error}</Notice>}
                        <Button
                          type={s === "recap" ? "button" : "submit"}
                          onClick={s === "recap" ? confirmAsPatient : undefined}
                          size="lg"
                          className="h-14 w-full text-base"
                          disabled={pending}
                          data-testid="qr-submit"
                        >
                          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
                          {t(flow === "book" ? "qrBook.confirm" : "qrBook.saveFavorite")}
                        </Button>
                        {s === "identity" && <p className="text-center text-xs text-muted">{t(flow === "book" ? "qrBook.bookFootnote" : "qrBook.favoriteFootnote")}</p>}
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
