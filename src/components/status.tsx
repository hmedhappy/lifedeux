import type { BookingStatus, ConsultationStatus, TrackingStep } from "@prisma/client";
import clsx from "clsx";
import type { TFunction } from "@/lib/i18n";
import { trackingSequence } from "@/lib/tracking";
import { Badge, type BadgeTone } from "./ui";

const tones: Record<BookingStatus | ConsultationStatus, BadgeTone> = {
  REQUESTED: "amber",
  CONFIRMED: "blue",
  REFUSED: "red",
  EXPIRED: "gray",
  PAID: "green",
  IN_PROGRESS: "trip",
  COMPLETED: "gray",
  CANCELLED: "gray",
  NO_SHOW: "red",
};

export function StatusBadge({ status, t, mode }: { status: BookingStatus | ConsultationStatus; t: TFunction; mode?: "ONLINE" | "IN_PERSON" }) {
  // At the practice nothing is paid online: once confirmed, the appointment is settled.
  if (mode === "IN_PERSON" && status === "CONFIRMED") return <Badge tone="green">{t("cabinet.confirmed")}</Badge>;
  return <Badge tone={tones[status]}>{t(`status.${status}`)}</Badge>;
}

/** Small "Au cabinet" tag next to appointments at the practice. */
export function CabinetTag({ t }: { t: TFunction }) {
  return <Badge tone="blue">{t("cabinet.tag")}</Badge>;
}

export function TrackingTimeline({
  current,
  hasAccommodation,
  t,
  times,
}: {
  current: TrackingStep | null;
  hasAccommodation: boolean;
  t: TFunction;
  times?: Partial<Record<TrackingStep, string>>;
}) {
  const steps = trackingSequence(hasAccommodation);
  const reached = current ? steps.indexOf(current) : -1;
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => (
        <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 && (
            <span className={clsx("absolute start-[11px] top-6 h-full w-0.5", i < reached ? "bg-brand" : "bg-line")} aria-hidden />
          )}
          <span
            className={clsx(
              "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
              i <= reached ? "border-brand bg-brand text-white" : "border-line bg-white text-muted",
            )}
          >
            {i <= reached ? "✓" : i + 1}
          </span>
          <div>
            <p className={clsx("text-sm", i <= reached ? "font-semibold text-ink" : "text-muted")}>{t(`tracking.${step}`)}</p>
            {times?.[step] && <p className="text-xs text-muted">{times[step]}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

const JOURNEY = ["requested", "confirmed", "options", "paid", "trip"] as const;

export function journeyIndex(status: BookingStatus, optionsChosen: boolean): number {
  switch (status) {
    case "REQUESTED":
      return 0;
    case "CONFIRMED":
      return optionsChosen ? 2 : 1;
    case "PAID":
      return 3;
    case "IN_PROGRESS":
    case "COMPLETED":
      return 4;
    default:
      return -1;
  }
}

export function JourneyStepper({ index, t }: { index: number; t: TFunction }) {
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label={t("booking.progress")}>
      {JOURNEY.map((key, i) => (
        <li key={key}>
          <span className={clsx("block h-1.5 rounded-full", i <= index ? "bg-brand" : "bg-line")} />
          <span className={clsx("mt-2 block text-xs", i <= index ? "font-semibold text-ink" : "text-muted")}>
            {t(`booking.journey.${key}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}
