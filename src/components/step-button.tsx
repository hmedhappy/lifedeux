"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Loader2 } from "lucide-react";
import type { TrackingStep } from "@prisma/client";
import type { StepResult } from "@/actions/scan";
import { useI18n } from "./i18n-provider";
import { useToast } from "./toast";
import { Button } from "./ui";

type Queued = { token: string; step: TrackingStep; at: number };
const KEY = "ld-agent-queue";

function readQueue(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Queued[];
  } catch {
    return [];
  }
}

function writeQueue(list: Queued[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: the step simply has to be tapped again once online.
  }
}

type Advance = (step: TrackingStep, token: string) => Promise<StepResult>;

/**
 * The agent's step button. Without network the tap is kept on the phone and sent as
 * soon as the connection is back (airport, car park…).
 */
export function StepButton({ token, step, label, advance }: { token: string; step: TrackingStep; label: string; advance: Advance }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState(false);

  function enqueue() {
    writeQueue([...readQueue().filter((q) => q.token !== token), { token, step, at: Date.now() }]);
    setQueued(true);
    toast(t("scan.queued"), { tone: "info" });
  }

  function click() {
    if (!navigator.onLine) return enqueue();
    start(async () => {
      try {
        const res = await advance(step, token);
        if (!res.ok) toast(t(res.reason === "doctor" ? "scan.doctorStep" : "scan.stale"), { tone: "error" });
        router.refresh();
      } catch {
        enqueue();
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button size="lg" className="w-full" onClick={click} disabled={pending || queued} data-testid="scan-step">
        {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : queued ? <CloudOff className="h-5 w-5" aria-hidden /> : null}
        {queued ? t("scan.queuedButton") : label}
      </Button>
    </div>
  );
}

/** Replays steps tapped offline, when the page loads and whenever the network returns. */
export function OfflineQueue({ advance }: { advance: Advance }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let busy = false;
    async function flush() {
      const list = readQueue();
      setCount(list.length);
      if (busy || !navigator.onLine || list.length === 0) return;
      busy = true;
      const left: Queued[] = [];
      let sent = 0;
      for (const q of list) {
        try {
          await advance(q.step, q.token);
          sent++;
        } catch {
          left.push(q);
        }
      }
      writeQueue(left);
      setCount(left.length);
      busy = false;
      if (sent) {
        toast(t("scan.synced", { n: sent }));
        router.refresh();
      }
    }
    const first = setTimeout(flush, 0);
    window.addEventListener("online", flush);
    return () => {
      clearTimeout(first);
      window.removeEventListener("online", flush);
    };
  }, [advance, router, t, toast]);

  if (count === 0) return null;
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="offline-queue">
      <CloudOff className="h-4 w-4" aria-hidden />
      {t("scan.queueCount", { n: count })}
    </p>
  );
}
