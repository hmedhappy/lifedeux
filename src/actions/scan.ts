"use server";

import { revalidatePath } from "next/cache";
import type { TrackingStep } from "@prisma/client";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { IMAGE_PATH_PREFIX, saveUploadedImages } from "@/lib/images";
import { toLocale } from "@/lib/i18n";
import { DOCTOR_ONLY_STEPS, nextTrackingStep } from "@/lib/tracking";
import { advanceTracking } from "@/lib/tracking-server";

async function currentAgent() {
  const user = await getCurrentUser();
  return user && (user.role === "AGENT" || user.role === "ADMIN") ? user : null;
}

export type StepResult = { ok: true } | { ok: false; reason: "forbidden" | "stale" | "doctor" };

/**
 * Applies the next tracking step. Only the step the agent actually saw is applied, so a
 * double tap — or a queued offline tap replayed later — can never skip one.
 */
export async function advanceStepAction(localeRaw: string, token: string, expected: TrackingStep): Promise<StepResult> {
  const locale = toLocale(localeRaw);
  const user = await currentAgent();
  if (!user) return { ok: false, reason: "forbidden" };
  if (DOCTOR_ONLY_STEPS.includes(expected)) return { ok: false, reason: "doctor" };
  const booking = await db.booking.findUnique({ where: { qrToken: token } });
  if (!booking) return { ok: false, reason: "stale" };
  if (nextTrackingStep(booking.trackingStep, !!booking.accommodationId) !== expected) return { ok: false, reason: "stale" };
  const done = await advanceTracking(booking.id, expected, user.id);
  revalidatePath(`/${locale}/scan/${token}`);
  return done ? { ok: true } : { ok: false, reason: "stale" };
}

/** Same, with the step first: used by the offline queue, bound to the locale. */
export async function applyStepAction(localeRaw: string, step: TrackingStep, token: string): Promise<StepResult> {
  return advanceStepAction(localeRaw, token, step);
}

const KINDS = ["late", "health", "lodging", "transport", "other"] as const;

/** "Signaler un incident": note and optional photo; the admin is alerted at once. */
export async function reportIncidentAction(localeRaw: string, token: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const user = await currentAgent();
  if (!user) return fail("errors.forbidden");
  const booking = await db.booking.findUnique({ where: { qrToken: token } });
  if (!booking) return fail("errors.invalid");
  const kind = String(formData.get("kind") ?? "");
  if (!KINDS.includes(kind as (typeof KINDS)[number])) return fail("errors.missingFields");
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000) || null;
  const photo = await saveUploadedImages(formData, "photo", 1, { private: true });
  if ("error" in photo) return fail(photo.error);
  const imageId = photo.paths[0]?.slice(IMAGE_PATH_PREFIX.length) ?? null;
  await db.$transaction([
    db.incident.create({ data: { bookingId: booking.id, agentId: user.id, kind, note, imageId } }),
    db.alert.create({
      data: {
        kind: "incident",
        severity: kind === "health" || kind === "lodging" ? "urgent" : "normal",
        message: `Incident (${kind}) on ${booking.reference}${note ? `: ${note.slice(0, 120)}` : ""}`,
        bookingId: booking.id,
      },
    }),
  ]);
  revalidatePath(`/${locale}/scan/${token}`);
  return ok("incident.sent");
}
