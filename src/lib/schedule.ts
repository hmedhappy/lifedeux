import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { tunisDayKey } from "./format";
import { HORIZON_WEEKS, parseSchedule, scheduleStarts } from "./schedule-rules";

/**
 * Makes the doctor's free consultation slots match their weekly schedule over the next
 * 4 weeks: missing slots are created, free unused ones that no longer fit are removed.
 * Slots with a booking (even refused) and operation slots are never touched.
 */
export async function syncScheduleSlots(doctorId: string, now = new Date()): Promise<{ created: number; removed: number }> {
  const doctor = await db.doctor.findUnique({ where: { id: doctorId }, include: { scheduleExceptions: true } });
  if (!doctor?.weeklySchedule) return { created: 0, removed: 0 };
  const schedule = parseSchedule(doctor.weeklySchedule);
  const days = HORIZON_WEEKS * 7;
  const end = new Date(now.getTime() + (days + 1) * 86_400_000);
  const target = scheduleStarts(schedule, tunisDayKey(now), days, doctor.consultationMinutes, doctor.bufferMinutes, doctor.scheduleExceptions).filter(
    (d) => d > now,
  );
  const wanted = new Set(target.map((d) => d.getTime()));

  const existing = await db.slot.findMany({
    where: { doctorId, startsAt: { gt: now, lt: end } },
    include: { _count: { select: { bookings: true, consultations: true } } },
  });
  const removable = existing.filter(
    (s) => s.kind === "CONSULTATION" && s.status === "FREE" && s._count.bookings + s._count.consultations === 0 && !wanted.has(s.startsAt.getTime()),
  );
  if (removable.length) await db.slot.deleteMany({ where: { id: { in: removable.map((s) => s.id) } } });

  // A new slot must not overlap any slot that stays (booked consultations, operations…).
  const kept = existing.filter((s) => !removable.includes(s)).map((s) => s.startsAt.getTime());
  const gap = (doctor.consultationMinutes + doctor.bufferMinutes) * 60_000;
  const fresh = target.filter((d) => kept.every((k) => Math.abs(k - d.getTime()) >= gap));
  const created = fresh.length
    ? (await db.slot.createMany({ data: fresh.map((startsAt) => ({ doctorId, startsAt, kind: "CONSULTATION" as const })), skipDuplicates: true })).count
    : 0;
  return { created, removed: removable.length };
}

/** Rolls every schedule forward (called by the daily cron). */
export async function syncAllSchedules(): Promise<number> {
  const doctors = await db.doctor.findMany({ where: { active: true, NOT: { weeklySchedule: { equals: Prisma.AnyNull } } }, select: { id: true } });
  let created = 0;
  for (const d of doctors) created += (await syncScheduleSlots(d.id)).created;
  return created;
}
