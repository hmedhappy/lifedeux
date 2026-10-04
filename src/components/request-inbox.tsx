"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Building2, Check, ChevronRight, ImageIcon, Scissors, ShieldCheck, Video, X } from "lucide-react";
import { answerRequestAction, type InboxAnswer } from "@/actions/inbox";
import { useI18n } from "./i18n-provider";
import { Sheet } from "./overlay";
import { useToast } from "./toast";
import { Button, Field, Input, Notice, Textarea } from "./ui";

export type InboxItem = {
  kind: "consultation" | "booking";
  id: string;
  reference: string;
  /** First name and initial only: contact details stay hidden until payment. */
  name: string;
  country: string | null;
  when: string;
  fee: string;
  service: string;
  reason: string | null;
  photos: number;
  held: boolean;
  nights: number;
  /** Appointment at the practice: `fee` is then the price paid there. */
  inPerson?: boolean;
};

const UNDO_MS = 5000;
const SWIPE_PX = 90;
const REASONS = ["unavailable", "inPerson", "otherSpecialty", "notSuitable"] as const;

export function RequestInbox({ items, locale }: { items: InboxItem[]; locale: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<InboxItem | null>(null);
  const [refusing, setRefusing] = useState<InboxItem | null>(null);
  const [nights, setNights] = useState<Record<string, number>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const hide = (id: string, on: boolean) =>
    setHidden((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function send(answer: InboxAnswer) {
    const res = await answerRequestAction(locale, answer);
    if (!res.ok) {
      hide(answer.id, false);
      toast(t(res.error), { tone: "error" });
    }
    router.refresh();
  }

  /** Acceptance waits 5 s so a mistaken tap or swipe can be undone. */
  function accept(item: InboxItem) {
    setDetail(null);
    hide(item.id, true);
    const timer = setTimeout(() => {
      timers.current.delete(item.id);
      send({ kind: item.kind, id: item.id, accept: true, recoveryNights: nights[item.id] ?? item.nights });
    }, UNDO_MS);
    timers.current.set(item.id, timer);
    toast(t("inbox.accepted", { name: item.name }), {
      duration: UNDO_MS,
      action: {
        label: t("inbox.undo"),
        onClick: () => {
          clearTimeout(timers.current.get(item.id));
          timers.current.delete(item.id);
          hide(item.id, false);
        },
      },
    });
  }

  const visible = items.filter((i) => !hidden.has(i.id));
  if (visible.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-muted" data-testid="inbox-empty">
        {t("doctorArea.noRequests")}
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-card" data-testid="inbox">
        {visible.map((item) => (
          <SwipeRow key={item.id} onAccept={() => (item.kind === "booking" ? setDetail(item) : accept(item))} onRefuse={() => setRefusing(item)}>
            <button type="button" onClick={() => setDetail(item)} className="flex w-full items-center gap-3 px-4 py-3.5 text-start hover:bg-surface/60" data-testid="inbox-row">
              <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", item.kind === "booking" ? "bg-trip-soft text-trip" : "bg-brand-soft text-brand")}>
                {item.kind === "booking" ? (
                  <Scissors className="h-5 w-5" aria-hidden />
                ) : item.inPerson ? (
                  <Building2 className="h-5 w-5" aria-hidden />
                ) : (
                  <Video className="h-5 w-5" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold text-ink">{item.name}</span>
                  {item.held && <ShieldCheck className="h-4 w-4 shrink-0 text-brand" aria-label={t("inbox.held")} />}
                </span>
                <span className="block truncate text-sm text-muted">
                  {item.when} · {item.service}
                </span>
              </span>
              <span className="hidden text-sm font-semibold text-ink sm:block">{item.fee}</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted rtl:-scale-x-100" aria-hidden />
            </button>
          </SwipeRow>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted md:hidden">{t("inbox.swipeHint")}</p>

      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? detail.name : ""}
        size="md"
        testId="inbox-detail"
        footer={
          detail && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => (setRefusing(detail), setDetail(null))} data-testid="inbox-refuse">
                <X className="h-4 w-4" aria-hidden />
                {t("doctorArea.refuse")}
              </Button>
              <Button onClick={() => accept(detail)} data-testid="inbox-accept">
                <Check className="h-4 w-4" aria-hidden />
                {t("inbox.accept")}
              </Button>
            </div>
          )
        }
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <Info label={t("doctorArea.service")} value={detail.service} />
              <Info label={t("doctorArea.slot")} value={detail.when} />
              <Info label={t(detail.inPerson ? "cabinet.price" : "doctorArea.fee")} value={detail.fee} />
              <Info label={t("fields.country")} value={detail.country ?? "—"} />
            </dl>
            {detail.reason && (
              <p className="rounded-2xl bg-surface p-4 text-ink">
                <span className="block text-xs font-semibold text-muted">{t(detail.kind === "booking" ? "doctorArea.patientNote" : "consult.reason")}</span>
                {detail.reason}
              </p>
            )}
            {detail.photos > 0 && (
              <p className="flex items-center gap-2 text-muted">
                <ImageIcon className="h-4 w-4" aria-hidden />
                {t("inbox.photos", { n: detail.photos })}
              </p>
            )}
            {detail.held && <Notice tone="success">{t("inbox.heldText")}</Notice>}
            <p className="text-xs text-muted">{t("inbox.contactsLater")}</p>
            {detail.kind === "booking" && (
              <Field label={t("doctorArea.recoveryNights")} hint={t("doctorArea.recoveryHint")}>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={nights[detail.id] ?? detail.nights}
                  onChange={(e) => setNights((n) => ({ ...n, [detail.id]: Number(e.target.value) }))}
                />
              </Field>
            )}
          </div>
        )}
      </Sheet>

      <RefuseSheet
        item={refusing}
        onClose={() => setRefusing(null)}
        onRefuse={(item, reason) => {
          setRefusing(null);
          hide(item.id, true);
          send({ kind: item.kind, id: item.id, accept: false, reason }).then(() => toast(t("inbox.refused", { name: item.name })));
        }}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function RefuseSheet({ item, onClose, onRefuse }: { item: InboxItem | null; onClose: () => void; onRefuse: (item: InboxItem, reason: string) => void }) {
  const { t } = useI18n();
  const [choice, setChoice] = useState<string | null>(null);
  const [text, setText] = useState("");
  const reason = [choice ? t(`inbox.reasons.${choice}`) : "", text.trim()].filter(Boolean).join(" — ");
  return (
    <Sheet open={!!item} onClose={onClose} title={t("inbox.refuseTitle")} size="sm" testId="inbox-refuse-sheet">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={choice === r}
              onClick={() => setChoice(choice === r ? null : r)}
              className={clsx(
                "min-h-10 rounded-full border px-3 text-sm transition",
                choice === r ? "border-brand bg-brand-soft font-semibold text-brand-dark" : "border-line bg-white text-ink-soft",
              )}
            >
              {t(`inbox.reasons.${r}`)}
            </button>
          ))}
        </div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={400} placeholder={t("inbox.refuseNote")} aria-label={t("inbox.refuseNote")} />
        <Button variant="dangerSolid" className="w-full" disabled={!reason} onClick={() => item && onRefuse(item, reason)} data-testid="inbox-refuse-send">
          {t("doctorArea.refuse")}
        </Button>
      </div>
    </Sheet>
  );
}

/** Swipe right to accept, left to refuse (phones). Taps still open the detail. */
function SwipeRow({ children, onAccept, onRefuse }: { children: React.ReactNode; onAccept: () => void; onRefuse: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  return (
    <li
      className="relative touch-pan-y"
      onPointerDown={(e) => {
        if (e.pointerType !== "touch") return;
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const x = e.clientX - start.current.x;
        if (Math.abs(e.clientY - start.current.y) > Math.abs(x)) return;
        setDx(Math.max(-140, Math.min(140, x)));
      }}
      onPointerUp={() => {
        if (dx > SWIPE_PX) onAccept();
        else if (dx < -SWIPE_PX) onRefuse();
        start.current = null;
        setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
    >
      <span className={clsx("absolute inset-0 flex items-center px-6", dx > 0 ? "justify-start bg-brand text-white" : "justify-end bg-red-600 text-white")} aria-hidden>
        {dx > 0 ? <Check className="h-6 w-6" /> : dx < 0 ? <X className="h-6 w-6" /> : null}
      </span>
      <div className={clsx("relative bg-white", dx === 0 && "transition-transform")} style={{ transform: `translateX(${dx}px)` }}>
        {children}
      </div>
    </li>
  );
}
