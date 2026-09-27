import type { TrackingStep } from "@prisma/client";

const FULL_SEQUENCE: TrackingStep[] = [
  "ARRIVED_AIRPORT",
  "AT_ACCOMMODATION",
  "AT_CLINIC",
  "OPERATED",
  "RECOVERING",
  "DEPARTED",
];

/** Steps a patient goes through; lodging steps only apply when accommodation was booked. */
export function trackingSequence(hasAccommodation: boolean): TrackingStep[] {
  return hasAccommodation
    ? FULL_SEQUENCE
    : FULL_SEQUENCE.filter((s) => s !== "AT_ACCOMMODATION" && s !== "RECOVERING");
}

export function nextTrackingStep(
  current: TrackingStep | null,
  hasAccommodation: boolean,
): TrackingStep | null {
  const sequence = trackingSequence(hasAccommodation);
  if (current === null) return sequence[0];
  const index = sequence.indexOf(current);
  if (index === -1 || index === sequence.length - 1) return null;
  return sequence[index + 1];
}
