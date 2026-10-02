"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { PAYMENT_CUTOFF_HOURS } from "@/lib/constants";
import { formatDateTime, fromTunisLocal } from "@/lib/format";
import { toLocale } from "@/lib/i18n";
import { sendTemplate } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { advanceTracking } from "@/lib/tracking-server";
import { isDoctorRole } from "@/lib/roles";
import { IMAGE_PATH_PREFIX, saveUploadedImages } from "@/lib/images";

async function currentDoctor() {
  const user = await getCurrentUser();
  if (!user || !isDoctorRole(user.role)) return null;
  const doctor = await db.doctor.findUnique({ where: { userId: user.id } });
  return doctor ? { user, doctor } : null;
}

export async function confirmBookingAction(
  localeRaw: string,
  bookingId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) return fail("errors.forbidden");
  const nights = z.coerce.number().int().min(1).max(60).safeParse(formData.get("recoveryNights"));
  if (!nights.success) return fail("errors.recoveryNights");

  const booking = await db.booking.findFirst({
    where: { id: bookingId, doctorId: me.doctor.id, status: "REQUESTED" },
    include: { slot: true, patient: true },
  });
  if (!booking) return fail("errors.invalid");

  const settings = await getSettings();
  const now = Date.now();
  const cutoff = booking.slot.startsAt.getTime() - PAYMENT_CUTOFF_HOURS * 60 * 60 * 1000;
  const deadline = new Date(Math.min(now + settings.paymentDeadlineHours * 60 * 60 * 1000, cutoff));
  if (deadline.getTime() <= now) return fail("errors.tooLate");

  const updated = await db.booking.updateMany({
    where: { id: booking.id, status: "REQUESTED" },
    data: { status: "CONFIRMED", confirmedAt: new Date(), paymentDeadline: deadline, recoveryNights: nights.data },
  });
  if (updated.count === 0) return fail("errors.invalid");

  await sendTemplate(
    booking.patient,
    "confirmed",
    {
      reference: booking.reference,
      date: formatDateTime(booking.slot.startsAt, toLocale(booking.patient.locale)),
      deadline: formatDateTime(deadline, toLocale(booking.patient.locale)),
    },
    `/account/bookings/${booking.id}`,
  );
  revalidatePath(`/${locale}/doctor`);
  redirect(`/${locale}/doctor?done=confirmed&ref=${booking.reference}`);
}

export async function refuseBookingAction(
  localeRaw: string,
  bookingId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) return fail("errors.forbidden");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!reason) return fail("errors.reasonRequired");

  const booking = await db.booking.findFirst({
    where: { id: bookingId, doctorId: me.doctor.id, status: { in: ["REQUESTED", "CONFIRMED"] }, paidAt: null },
    include: { patient: true },
  });
  if (!booking) return fail("errors.invalid");

  await db.$transaction([
    db.booking.update({ where: { id: booking.id }, data: { status: "REFUSED", refusalReason: reason } }),
    db.slot.updateMany({ where: { id: booking.slotId, status: "HELD" }, data: { status: "FREE" } }),
    db.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { status: "FAILED" } }),
  ]);
  await sendTemplate(booking.patient, "refused", { reference: booking.reference, reason }, `/account/bookings/${booking.id}`);
  revalidatePath(`/${locale}/doctor`);
  redirect(`/${locale}/doctor?done=refused&ref=${booking.reference}`);
}

export async function markOperatedAction(localeRaw: string, bookingId: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) return;
  const booking = await db.booking.findFirst({ where: { id: bookingId, doctorId: me.doctor.id } });
  if (!booking) return;
  await advanceTracking(booking.id, "OPERATED", me.user.id);
  revalidatePath(`/${locale}/doctor/patients`);
}

const slotsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  times: z.string().min(4),
});

const MAX_SLOTS_PER_BATCH = 500;

export async function addSlotsAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) return fail("errors.forbidden");
  const parsed = slotsSchema.safeParse({
    from: formData.get("from"),
    to: formData.get("to") ?? "",
    times: formData.get("times"),
  });
  if (!parsed.success) return fail("errors.slotsInput");

  const times = parsed.data.times
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^\d:\d{2}$/.test(s) ? `0${s}` : s));
  if (times.length === 0 || times.some((s) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s))) return fail("errors.slotsInput");

  const weekdays = new Set(formData.getAll("weekdays").map((d) => Number(d)));
  const from = parsed.data.from;
  const to = parsed.data.to || from;
  if (to < from) return fail("errors.slotsInput");

  const dates: Date[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10);
    if (weekdays.size === 0 || weekdays.has(cursor.getUTCDay())) {
      for (const time of times) {
        const startsAt = fromTunisLocal(day, time);
        if (startsAt.getTime() > Date.now()) dates.push(startsAt);
      }
    }
    if (dates.length > MAX_SLOTS_PER_BATCH) return fail("errors.tooManySlots", { n: MAX_SLOTS_PER_BATCH });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (dates.length === 0) return fail("errors.noSlotsCreated");

  const kind = formData.get("kind") === "CONSULTATION" ? "CONSULTATION" : "OPERATION";
  const created = await db.slot.createMany({
    data: dates.map((startsAt) => ({ doctorId: me.doctor.id, startsAt, kind })),
    skipDuplicates: true,
  });
  revalidatePath(`/${locale}/doctor/slots`);
  return ok("doctorArea.slotsCreated", { vars: { n: created.count } });
}

export async function deleteSlotAction(localeRaw: string, slotId: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) return;
  // Only free slots that were never booked can be removed.
  await db.slot.deleteMany({ where: { id: slotId, doctorId: me.doctor.id, status: "FREE", bookings: { none: {} }, consultations: { none: {} } } });
  revalidatePath(`/${locale}/doctor/slots`);
}

/**
 * The doctor sends a photo of their stamp; it is used on prescriptions once the admin
 * validates it. The signature is the doctor's own and applies at once.
 */
export async function uploadSignaturesAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) return fail("errors.forbidden");
  const opts = { private: true, types: ["image/png", "image/jpeg"] } as const;
  const stamp = await saveUploadedImages(formData, "stampFile", 1, opts);
  if ("error" in stamp) return fail(stamp.error);
  const signature = await saveUploadedImages(formData, "signatureFile", 1, opts);
  if ("error" in signature) return fail(signature.error);
  const id = (paths: string[]) => (paths[0] ? paths[0].slice(IMAGE_PATH_PREFIX.length) : undefined);
  const stampId = id(stamp.paths);
  const signatureId = id(signature.paths);
  if (!stampId && !signatureId) return fail("errors.missingFields");
  await db.doctor.update({
    where: { id: me.doctor.id },
    data: { ...(stampId ? { pendingStampImageId: stampId } : {}), ...(signatureId ? { signatureImageId: signatureId } : {}) },
  });
  if (stampId) {
    await db.alert.create({ data: { kind: "stampToReview", message: `Stamp to review for Dr ${me.user.lastName}`, doctorId: me.doctor.id } });
  }
  revalidatePath(`/${locale}/doctor`, "layout");
  return ok(stampId ? "rxTemplates.stampSent" : "rxTemplates.signatureSaved");
}
