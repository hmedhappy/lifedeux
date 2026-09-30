"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { FileText, ImagePlus, Loader2, Phone, Send, Video, X } from "lucide-react";
import type { ChatMessage } from "@/lib/consultations";
import type { ChatState } from "@/lib/consultation-rules";
import { useI18n } from "./i18n-provider";
import { shrink } from "./image-input";
import { Avatar } from "./ui";

const POLL_MS = 3000;
const intl = { fr: "fr-FR", en: "en-GB", ar: "ar-TN" } as const;

export function Chat({
  consultationId,
  peerName,
  peerSubtitle,
  initialMessages,
  initialState,
  side,
}: {
  consultationId: string;
  peerName: string;
  peerSubtitle?: string;
  initialMessages: ChatMessage[];
  initialState: ChatState;
  side?: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState(initialMessages);
  const [state, setState] = useState(initialState);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef(initialMessages.at(-1)?.createdAt);

  const refresh = useCallback(async () => {
    const qs = lastRef.current ? `?after=${encodeURIComponent(lastRef.current)}` : "";
    const res = await fetch(`/api/consultations/${consultationId}/messages${qs}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { messages: ChatMessage[]; state: ChatState };
    setState(data.state);
    if (data.messages.length) {
      lastRef.current = data.messages.at(-1)!.createdAt;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...data.messages.filter((m) => !seen.has(m.id))];
      });
    }
  }, [consultationId]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

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

  async function sendText(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    if (await post(JSON.stringify({ text: value }), true)) setText("");
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <section className="flex h-[70vh] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-line bg-white" aria-label={t("chat.title")}>
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={peerName} size={40} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{peerName}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span className={clsx("h-2 w-2 rounded-full", open ? "bg-emerald-500" : "bg-line")} aria-hidden />
                {open ? t("chat.live") : state === "waiting" ? t("chat.waiting") : t("chat.closed")}
                {peerSubtitle && <span>· {peerSubtitle}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[
              { icon: Phone, label: t("chat.call") },
              { icon: Video, label: t("chat.video") },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                disabled
                title={`${label} — ${t("chat.soon")}`}
                aria-label={`${label} — ${t("chat.soon")}`}
                className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full text-muted/60"
              >
                <Icon className="h-5 w-5" aria-hidden />
              </button>
            ))}
          </div>
        </header>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-surface/60 px-4 py-5" data-testid="chat-messages" aria-live="polite">
          {messages.length === 0 && <p className="mt-10 text-center text-sm text-muted">{open ? t("chat.empty") : t("chat.waitingText")}</p>}
          {messages.map((m) => (
            <div key={m.id} className={clsx("flex", m.mine ? "justify-end" : "justify-start")} data-testid="chat-message">
              <div
                className={clsx(
                  "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                  m.mine ? "rounded-ee-md bg-brand text-white" : "rounded-es-md bg-white text-ink",
                )}
              >
                {!m.mine && <p className="mb-0.5 text-xs font-semibold opacity-70">{m.senderName}</p>}
                {m.kind === "IMAGE" && m.imageUrl && (
                  <button type="button" onClick={() => setZoom(m.imageUrl)} className="block overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.imageUrl} alt={t("chat.image")} className="max-h-64 w-auto" data-testid="chat-image" />
                  </button>
                )}
                {m.kind === "PRESCRIPTION" && m.prescription && (
                  <a
                    href={m.prescription.pdfUrl}
                    target="_blank"
                    rel="noopener"
                    className={clsx("flex items-center gap-3 rounded-xl p-3", m.mine ? "bg-white/15" : "bg-emerald-50 text-emerald-900")}
                    data-testid="chat-prescription"
                  >
                    <FileText className="h-8 w-8 shrink-0" aria-hidden />
                    <span>
                      <span className="block font-semibold">{t("chat.prescription")}</span>
                      <span className="block text-xs opacity-80">
                        {m.prescription.number} · {t("chat.download")}
                      </span>
                    </span>
                  </a>
                )}
                {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                <p className={clsx("mt-1 text-end text-[10px]", m.mine ? "text-white/75" : "text-muted")}>{time(m.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{error}</p>}
        <form onSubmit={sendText} className="flex items-end gap-2 border-t border-line p-3">
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
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            disabled={!open}
            placeholder={open ? t("chat.placeholder") : t("chat.closedPlaceholder")}
            aria-label={t("chat.placeholder")}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-2.5 text-sm focus:border-ink focus:outline-none disabled:bg-surface"
            data-testid="chat-input"
          />
          <button
            type="submit"
            disabled={!open || sending || !text.trim()}
            aria-label={t("chat.send")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5 rtl:-scale-x-100" aria-hidden />}
          </button>
        </form>
      </section>

      {side}

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal onClick={() => setZoom(null)}>
          <button type="button" className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label={t("common.close")}>
            <X className="h-6 w-6" aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt={t("chat.image")} className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
