"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fromTunisLocal, parseMoneyToCents } from "@/lib/format";
import { toLocale } from "@/lib/i18n";
import { isPhotoRef, saveUploadedImages } from "@/lib/images";
import { isDoctorRole } from "@/lib/roles";
import { syncScheduleSlots } from "@/lib/schedule";
import { MAX_BUFFER_MINUTES, addDayKey, parseSchedule } from "@/lib/schedule-rules";

async function currentDoctor() {
  const user = await getCurrentUser();
  if (!user || !isDoctorRole(user.role)) return null;
  const doctor = await db.doctor.findUnique({ where: { userId: user.id } });
  return doctor ? { user, doctor } : null;
}

/** Saves the weekly schedule (form fields "d{weekday}" = "09:00-12:00, 14:00-17:00") and publishes 4 weeks of slots. */
export async function saveScheduleAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) return fail("errors.forbidden");
  const raw: Record<string, [string, string][]> = {};
  for (let d = 0; d < 7; d++) {
    const text = String(formData.get(`d${d}`) ?? "").trim();
    if (!text) continue;
    const ranges = text.split(/[,;]/).map((r) => r.trim()).filter(Boolean);
    const parsed = ranges.map((r) => r.split(/\s*[-–]\s*/) as [string, string]);
    if (parsed.some((p) => p.length !== 2)) return fail("errors.scheduleInvalid");
    raw[String(d)] = parsed.map(([a, b]) => [a.padStart(5, "0"), b.padStart(5, "0")]);
  }
  const schedule = parseSchedule(raw);
  const given = Object.values(raw).flat().length;
  if (Object.values(schedule).flat().length !== given) return fail("errors.scheduleInvalid");
  const minutes = z.coerce.number().int().min(10).max(120).safeParse(formData.get("minutes"));
  const buffer = z.coerce.number().int().min(0).max(MAX_BUFFER_MINUTES).safeParse(formData.get("buffer"));
  if (!minutes.success || !buffer.success) return fail("errors.scheduleInvalid");
  await db.doctor.update({
    where: { id: me.doctor.id },
    data: { weeklySchedule: schedule, consultationMinutes: minutes.data, bufferMinutes: buffer.data },
  });
  const res = await syncScheduleSlots(me.doctor.id);
  revalidatePath(`/${locale}/doctor`, "layout");
  return ok("schedule.saved", { vars: { n: res.created } });
}

/** Vacation or day off. Refused if it would cancel a slot someone already booked. */
export async function addExceptionAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) return fail("errors.forbidden");
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "") || startsOn;
  if (!day.test(startsOn) || !day.test(endsOn) || endsOn < startsOn) return fail("errors.scheduleInvalid");
  const from = fromTunisLocal(startsOn, "00:00");
  const to = fromTunisLocal(addDayKey(endsOn, 1), "00:00");
  const taken = await db.slot.count({ where: { doctorId: me.doctor.id, startsAt: { gte: from, lt: to }, status: { in: ["HELD", "BOOKED"] } } });
  if (taken > 0) return fail("errors.vacationBooked", { n: taken });
  await db.scheduleException.create({
    data: { doctorId: me.doctor.id, startsOn, endsOn, reason: String(formData.get("reason") ?? "").trim().slice(0, 120) || null },
  });
  // Free slots of those days disappear, whether they come from the schedule or were added by hand.
  await db.slot.deleteMany({
    where: { doctorId: me.doctor.id, startsAt: { gte: from, lt: to }, status: "FREE", bookings: { none: {} }, consultations: { none: {} } },
  });
  await syncScheduleSlots(me.doctor.id);
  revalidatePath(`/${locale}/doctor/slots`);
  return ok("schedule.exceptionSaved");
}

export async function deleteExceptionAction(localeRaw: string, id: string): Promise<void> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) return;
  await db.scheduleException.deleteMany({ where: { id, doctorId: me.doctor.id } });
  await syncScheduleSlots(me.doctor.id);
  revalidatePath(`/${locale}/doctor/slots`);
}

const profileSchema = z.object({
  bio: z.string().trim().min(1).max(4000),
  // Optional for doctors who only consult online; required below for consultations at the clinic.
  clinicName: z.string().trim().max(160),
  clinicAddress: z.string().trim().max(300),
  city: z.string().trim().max(80),
  languages: z.string().trim().max(200),
  yearsOfExperience: z.coerce.number().int().min(0).max(70),
});

/**
 * The doctor edits their public profile. A new consultation price is only a request:
 * it applies once the admin validates it (docs/RELOOKING.md §7).
 */
export async function updateDoctorProfileAction(localeRaw: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const locale = toLocale(localeRaw);
  const me = await currentDoctor();
  if (!me) return fail("errors.forbidden");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("errors.missingFields");
  const photo = await saveUploadedImages(formData, "photoFile", 1);
  if ("error" in photo) return fail(photo.error);
  const photoUrl = photo.paths[0] ?? undefined;
  if (photoUrl && !isPhotoRef(photoUrl)) return fail("errors.invalid");

  const rawPrice = String(formData.get("consultationPrice") ?? "").trim();
  const price = rawPrice ? parseMoneyToCents(rawPrice) : null;
  if (rawPrice && !price) return fail("errors.invalid");
  const current = me.doctor.consultationPrice;
  const pendingConsultationPrice = price && price !== current ? price : me.doctor.pendingConsultationPrice;

  const offersInPerson = formData.get("offersInPerson") === "on";
  const rawInPerson = String(formData.get("inPersonPrice") ?? "").trim();
  const inPersonPrice = rawInPerson ? parseMoneyToCents(rawInPerson) : null;
  if (rawInPerson && !inPersonPrice) return fail("errors.invalid");
  if (offersInPerson && (!inPersonPrice || !parsed.data.clinicAddress || !parsed.data.city)) return fail("errors.missingFields");

  const { languages, ...rest } = parsed.data;
  await db.doctor.update({
    where: { id: me.doctor.id },
    data: {
      ...rest,
      languages: languages.split(/[,;]/).map((l) => l.trim()).filter(Boolean).slice(0, 8),
      ...(photoUrl ? { photoUrl } : {}),
      instantBooking: formData.get("instantBooking") === "on",
      offersConsultation: formData.get("offersConsultation") === "on",
      // Paid at the clinic, without commission: applies at once, no admin review.
      offersInPerson,
      inPersonPrice,
      pendingConsultationPrice: price === current ? null : pendingConsultationPrice,
    },
  });
  if (price && price !== current) {
    await db.alert.create({ data: { kind: "priceChange", message: `Price change requested by Dr ${me.user.lastName}`, doctorId: me.doctor.id } });
  }
  revalidatePath(`/${locale}/doctor`, "layout");
  return ok(price && price !== current ? "doctorProfile.savedPricePending" : "doctorProfile.saved");
}
