"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Building2, Check, CheckCheck, FileText, ImagePlus, Loader2, Phone, Scissors, Send, Video, X } from "lucide-react";
import type { ChatMessage, PeerStatus } from "@/lib/consultations";
import type { ChatState } from "@/lib/consultation-rules";
import { useI18n } from "./i18n-provider";
import { shrink } from "./image-input";
import { Avatar } from "./ui";

const POLL_MS = 3000;
const TYPING_PING_MS = 3000;
const intl = { fr: "fr-FR", en: "en-GB", ar: "ar-TN-u-nu-latn" } as const;

export type Orientation = { clinic?: string | null; surgeryHref?: string | null };

/** A short two-tone chime, without any audio file. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * 0.12;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.3);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // Sound is a nicety; some browsers block it until the user interacts.
  }
}

export function Chat({
  consultationId,
  peerName,
  peerSubtitle,
  peerPhoto,
  initialMessages,
  initialState,
  quickReplies,
  orientation,
  headerActions,
  backHref,
  fullscreenMobile,
  className,
}: {
  consultationId: string;
  peerName: string;
  peerSubtitle?: string;
  peerPhoto?: string | null;
  initialMessages: ChatMessage[];
  initialState: ChatState;
  /** One-tap messages shown above the input (doctor side). */
  quickReplies?: string[];
  orientation?: Orientation;
  headerActions?: React.ReactNode;
  backHref?: string;
  /** Takes the whole screen on phones while the conversation is open. */
  fullscreenMobile?: boolean;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState(initialMessages);
  const [state, setState] = useState(initialState);
  const [peer, setPeer] = useState<PeerStatus>({ online: false, typing: false, seenAt: null });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef(initialMessages.at(-1)?.createdAt);
  const typingRef = useRef(0);
  const unreadRef = useRef(0);
  const baseTitle = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const visible = document.visibilityState === "visible";
    const qs = new URLSearchParams();
    if (lastRef.current) qs.set("after", lastRef.current);
    if (visible) qs.set("seen", "1");
    const res = await fetch(`/api/consultations/${consultationId}/messages?${qs}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { messages: ChatMessage[]; state: ChatState; peer: PeerStatus };
    setState(data.state);
    setPeer(data.peer);
    if (data.messages.length) {
      lastRef.current = data.messages.at(-1)!.createdAt;
      const incoming = data.messages.filter((m) => !m.mine && m.kind !== "SYSTEM").length;
      if (incoming) {
        chime();
        if (!visible) {
          unreadRef.current += incoming;
          baseTitle.current ??= document.title;
          document.title = `(${unreadRef.current}) ${baseTitle.current}`;
        }
      }
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...data.messages.filter((m) => !seen.has(m.id))];
      });
    }
  }, [consultationId]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      unreadRef.current = 0;
      if (baseTitle.current) document.title = baseTitle.current;
      refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      if (baseTitle.current) document.title = baseTitle.current;
    };
  }, [refresh]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, peer.typing]);

  async function post(body: BodyInit, json: boolean) {
    setSending(true);
    setError(null);
    const res = await fetch(`/api/consultations/${consultationId}/messages`, {
      method: "POST",
      body,
      headers: json ? { "Content-Type": "application/json" } : undefined,
    }).catch(() => null);
    setSending(false);
    if (!res || !res.ok) {
      const code = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : undefined;
      setError(code === "closed" ? t("chat.closed") : code?.startsWith("errors.") ? t(code) : t("chat.sendFailed"));
      return false;
    }
    await refresh();
    return true;
  }

  async function send(value: string) {
    if (!value.trim() || sending) return;
    if (await post(JSON.stringify({ text: value.trim() }), true)) setText("");
  }

  function onType(value: string) {
    setText(value);
    const now = Date.now();
    if (value && now - typingRef.current > TYPING_PING_MS) {
      typingRef.current = now;
      fetch(`/api/consultations/${consultationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ typing: true }),
        headers: { "Content-Type": "application/json" },
      }).catch(() => null);
    }
  }

  async function sendImage(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.append("image", await shrink(file));
    await post(form, false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const time = (iso: string) => new Intl.DateTimeFormat(intl[locale], { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const open = state === "open";
  const peerSeen = peer.seenAt ? new Date(peer.seenAt).getTime() : 0;
  const statusLine = peer.typing
    ? t("chat.typing")
    : open
      ? peer.online
        ? t("chat.online")
        : t("chat.live")
      : state === "waiting"
        ? t("chat.waiting")
        : t("chat.closed");

  return (
    <section
      className={clsx(
        "flex flex-col overflow-hidden bg-white",
        fullscreenMobile
          ? "fixed inset-0 z-50 h-[100dvh] md:static md:z-auto md:h-[calc(100dvh-11rem)] md:min-h-[520px] md:rounded-3xl md:border md:border-line md:shadow-card"
          : "h-[70vh] min-h-[480px] rounded-3xl border border-line shadow-card",
        className,
      )}
      aria-label={t("chat.title")}
      data-testid="chat"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {backHref && (
            <Link
              href={backHref}
              aria-label={t("common.back")}
              className={clsx("-ms-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface", fullscreenMobile ? "md:hidden" : "hidden")}
            >
              <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
            </Link>
          )}
          <span className="relative shrink-0">
            <Avatar name={peerName} src={peerPhoto} size={40} />
            {open && peer.online && <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{peerName}</p>
            <p className={clsx("truncate text-xs", peer.typing ? "font-medium text-brand" : "text-muted")} data-testid="chat-status">
              {statusLine}
              {peerSubtitle && !peer.typing && <span> · {peerSubtitle}</span>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {[
            { icon: Phone, label: t("chat.call") },
            { icon: Video, label: t("chat.video") },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="relative hidden sm:block">
              <button
                type="button"
                disabled
                title={`${label} — ${t("chat.soon")}`}
                aria-label={`${label} — ${t("chat.soon")}`}
                className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full text-muted/60"
              >
                <Icon className="h-5 w-5" aria-hidden />
              </button>
              <span className="pointer-events-none absolute -top-1 start-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-coral-soft px-1.5 text-[9px] font-bold uppercase text-coral-ink rtl:translate-x-1/2">
                {t("chat.soon")}
              </span>
            </span>
          ))}
          {headerActions}
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto bg-surface/70 px-3 py-4 sm:px-4" data-testid="chat-messages" aria-live="polite">
        {messages.length === 0 && <p className="mt-10 text-center text-sm text-muted">{open ? t("chat.empty") : t("chat.waitingText")}</p>}
        {messages.map((m) =>
          m.kind === "SYSTEM" ? (
            <SystemLine key={m.id} m={m} orientation={orientation} />
          ) : (
            <div key={m.id} className={clsx("flex animate-fade-in", m.mine ? "justify-end" : "justify-start")} data-testid="chat-message">
              <div
                className={clsx(
                  "max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm sm:text-sm",
                  m.mine ? "rounded-ee-md bg-brand text-white" : "rounded-es-md bg-white text-ink",
                )}
              >
                {m.kind === "IMAGE" && m.imageUrl && (
                  <button type="button" onClick={() => setZoom(m.imageUrl)} className="mb-1 block overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.imageUrl} alt={t("chat.image")} className="max-h-64 w-auto" data-testid="chat-image" />
                  </button>
                )}
                {m.kind === "PRESCRIPTION" && m.prescription && (
                  <a
                    href={m.prescription.revoked ? undefined : m.prescription.pdfUrl}
                    target="_blank"
                    rel="noopener"
                    aria-disabled={m.prescription.revoked}
                    className={clsx(
                      "mb-1 flex items-center gap-3 rounded-xl p-3",
                      m.mine ? "bg-white/15" : "bg-brand-soft text-brand-dark",
                      m.prescription.revoked && "opacity-60",
                    )}
                    data-testid="chat-prescription"
                  >
                    <FileText className="h-8 w-8 shrink-0" aria-hidden />
                    <span>
                      <span className={clsx("block font-semibold", m.prescription.revoked && "line-through")}>{t("chat.prescription")}</span>
                      <span className="block text-xs opacity-80">
                        {m.prescription.number} · {m.prescription.revoked ? t("documents.revoked") : t("chat.download")}
                      </span>
                    </span>
                  </a>
                )}
                {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                <p className={clsx("mt-0.5 flex items-center justify-end gap-1 text-[10px]", m.mine ? "text-white/75" : "text-muted")}>
                  {time(m.createdAt)}
                  {m.mine &&
                    (new Date(m.createdAt).getTime() <= peerSeen ? (
                      <CheckCheck className="h-3.5 w-3.5 text-white" aria-label={t("chat.read")} data-testid="chat-read" />
                    ) : (
                      <Check className="h-3.5 w-3.5" aria-label={t("chat.sent")} />
                    ))}
                </p>
              </div>
            </div>
          ),
        )}
        {peer.typing && (
          <div className="flex justify-start" data-testid="chat-typing">
            <span className="flex gap-1 rounded-2xl rounded-es-md bg-white px-4 py-3 shadow-sm" aria-label={t("chat.typing")}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {open && quickReplies && quickReplies.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-line px-3 py-2" data-testid="quick-replies">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              disabled={sending}
              className="min-h-9 shrink-0 rounded-full border border-line bg-white px-3 text-sm text-ink-soft transition hover:border-brand hover:text-brand-dark"
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-end gap-2 border-t border-line p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => sendImage(e.target.files?.[0])}
          data-testid="chat-file"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!open || sending}
          aria-label={t("chat.attach")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface disabled:opacity-40"
        >
          <ImagePlus className="h-5 w-5" aria-hidden />
        </button>
        <textarea
          value={text}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          disabled={!open}
          placeholder={open ? t("chat.placeholder") : t("chat.closedPlaceholder")}
          aria-label={t("chat.placeholder")}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-2.5 text-base focus:border-brand focus:outline-none disabled:bg-surface sm:text-sm"
          data-testid="chat-input"
        />
        <button
          type="submit"
          disabled={!open || sending || !text.trim()}
          aria-label={t("chat.send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition active:scale-95 disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5 rtl:-scale-x-100" aria-hidden />}
        </button>
      </form>

      {zoom && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal onClick={() => setZoom(null)}>
          <button type="button" className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label={t("common.close")}>
            <X className="h-6 w-6" aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt={t("chat.image")} className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </section>
  );
}

/** Automatic lines: "joined", orientation cards, absent patient, end of the consultation. */
function SystemLine({ m, orientation }: { m: ChatMessage; orientation?: Orientation }) {
  const { t } = useI18n();
  const code = m.text ?? "";
  if (code.startsWith("orientation:")) {
    const surgery = code === "orientation:SURGERY";
    return (
      <div className="flex justify-center py-1" data-testid="chat-orientation">
        <div className={clsx("w-full max-w-sm rounded-2xl border p-4 text-sm", surgery ? "border-trip/20 bg-trip-soft" : "border-brand/20 bg-brand-soft")}>
          <p className={clsx("flex items-center gap-2 font-semibold", surgery ? "text-trip" : "text-brand-dark")}>
            {surgery ? <Scissors className="h-4 w-4" aria-hidden /> : <Building2 className="h-4 w-4" aria-hidden />}
            {t(surgery ? (m.mine ? "chat.system.orientSurgeryMine" : "chat.system.orientSurgery") : m.mine ? "chat.system.orientClinicMine" : "chat.system.orientClinic", {
              name: m.senderName,
            })}
          </p>
          {!surgery && orientation?.clinic && <p className="mt-1 text-ink-soft">{orientation.clinic}</p>}
          {surgery && orientation?.surgeryHref && (
            <Link href={orientation.surgeryHref} className="mt-2 inline-flex min-h-9 items-center rounded-full bg-white px-3 font-semibold text-trip shadow-sm">
              {t("chat.system.seeSurgery")}
            </Link>
          )}
        </div>
      </div>
    );
  }
  if (code.startsWith("rxRevoked:")) {
    return (
      <p className="flex justify-center py-1" data-testid="chat-system">
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900 shadow-sm">
          {t("chat.system.rxRevoked", { number: code.slice("rxRevoked:".length) })}
        </span>
      </p>
    );
  }
  const key = code === "joined" ? "chat.system.joined" : code === "noShow" ? "chat.system.noShow" : code === "ended" ? "chat.system.ended" : null;
  if (!key) return null;
  return (
    <p className="flex justify-center py-1" data-testid="chat-system">
      <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-muted shadow-sm">{t(key, { name: m.senderName })}</span>
    </p>
  );
}
