"use server";

import { revalidatePath } from "next/cache";
import type { TrackingStep } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toLocale } from "@/lib/i18n";
import { nextTrackingStep } from "@/lib/tracking";
import { advanceTracking } from "@/lib/tracking-server";

export async function advanceStepAction(localeRaw: string, token: string, expected: TrackingStep): Promise<void> {
  const locale = toLocale(localeRaw);
  const user = await getCurrentUser();
  if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) return;
  const booking = await db.booking.findUnique({ where: { qrToken: token } });
  if (!booking) return;
  // Only apply the step the agent actually saw, so a double tap cannot skip one.
  if (nextTrackingStep(booking.trackingStep, !!booking.accommodationId) !== expected) return;
  await advanceTracking(booking.id, expected, user.id);
  revalidatePath(`/${locale}/scan/${token}`);
}
