"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { acceptBooking, refuseBooking } from "@/lib/booking-flow";
import { acceptConsultation, refuseConsultation } from "@/lib/consultation-flow";
import { db } from "@/lib/db";
import { isDoctorRole } from "@/lib/roles";

export type InboxAnswer = { kind: "consultation" | "booking"; id: string; accept: boolean; reason?: string; recoveryNights?: number };
export type InboxResult = { ok: true; outcome: string } | { ok: false; error: string };

/**
 * Answers a request from the "Aujourd'hui" inbox without leaving the page. The screen
 * waits 5 seconds (with "Annuler") before calling this for an acceptance.
 */
export async function answerRequestAction(locale: string, answer: InboxAnswer): Promise<InboxResult> {
  const user = await getCurrentUser();
  if (!user || !isDoctorRole(user.role)) return { ok: false, error: "errors.forbidden" };
  const doctor = await db.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return { ok: false, error: "errors.forbidden" };
  const reason = answer.reason?.trim().slice(0, 500) ?? "";
  if (!answer.accept && !reason) return { ok: false, error: "errors.reasonRequired" };

  let outcome: string;
  if (answer.kind === "consultation") {
    const mine = await db.consultation.findFirst({ where: { id: answer.id, doctorId: doctor.id }, select: { id: true } });
    if (!mine) return { ok: false, error: "errors.invalid" };
    outcome = answer.accept ? await acceptConsultation(mine.id) : (await refuseConsultation(mine.id, doctor.id, reason)) ? "refused" : "invalid";
  } else {
    const nights = Math.round(Number(answer.recoveryNights));
    if (answer.accept && !(nights >= 1 && nights <= 60)) return { ok: false, error: "errors.recoveryNights" };
    outcome = answer.accept ? await acceptBooking(answer.id, doctor.id, nights) : (await refuseBooking(answer.id, doctor.id, reason)) ? "refused" : "invalid";
  }
  revalidatePath(`/${locale}/doctor`, "layout");
  if (outcome === "invalid") return { ok: false, error: "errors.invalid" };
  if (outcome === "tooLate") return { ok: false, error: "errors.tooLate" };
  return { ok: true, outcome };
}
