import "server-only";
import { expireOverdueBookings } from "./bookings";
import { db } from "./db";
import { addDays, formatDate, formatDateTime, formatTime, tunisDayKey } from "./format";
import { getT, toLocale } from "./i18n";
import { sendTemplate } from "./mail";
import { syncAllSchedules } from "./schedule";
import { addDayKey } from "./schedule-rules";

const HOUR = 3_600_000;
/** The doctor is reminded after 24 h without an answer; the admin is alerted at 48 h. */
export const NUDGE_AFTER_HOURS = 24;
export const ESCALATE_AFTER_HOURS = 48;
/** Agents get tomorrow's planning from 18:00, Tunis time. */
const PLANNING_HOUR = 18;

/** Runs a once-a-day job at most once per Tunis day, recorded in NotificationLog. */
async function oncePerDay(name: string, now: Date, run: () => Promise<void>) {
  const target = tunisDayKey(now);
  if (await db.notificationLog.findFirst({ where: { channel: "job", template: name, target } })) return;
  await db.notificationLog.create({ data: { channel: "job", template: name, target, status: "started" } });
  await run();
}

/** "La veille" (within 24 h) and "dans 10 minutes" reminders, to the patient and the doctor. */
export async function sendReminders(now = new Date()): Promise<number> {
  let sent = 0;
  const day = await db.consultation.findMany({
    where: { status: "PAID", reminderDaySentAt: null, slot: { startsAt: { gt: new Date(now.getTime() + 2 * HOUR), lt: new Date(now.getTime() + 24 * HOUR) } } },
    include: { patient: true, slot: true, doctor: { include: { user: true } } },
  });
  for (const c of day) {
    const res = await db.consultation.updateMany({ where: { id: c.id, reminderDaySentAt: null }, data: { reminderDaySentAt: now } });
    if (!res.count) continue;
    const date = formatDateTime(c.slot.startsAt, toLocale(c.patient.locale));
    await sendTemplate(c.patient, "reminderDay", { reference: c.reference, date, doctor: `Dr ${c.doctor.user.lastName}` }, `/account/consultations/${c.id}`);
    sent++;
  }
  const soon = await db.consultation.findMany({
    where: { status: "PAID", reminderSoonSentAt: null, slot: { startsAt: { gt: now, lt: new Date(now.getTime() + 15 * 60_000) } } },
    include: { patient: true, slot: true, doctor: { include: { user: true } } },
  });
  for (const c of soon) {
    const res = await db.consultation.updateMany({ where: { id: c.id, reminderSoonSentAt: null }, data: { reminderSoonSentAt: now } });
    if (!res.count) continue;
    const time = (l: string) => formatTime(c.slot.startsAt, toLocale(l));
    await sendTemplate(c.patient, "reminderSoon", { reference: c.reference, time: time(c.patient.locale) }, `/account/consultations/${c.id}`);
    await sendTemplate(c.doctor.user, "reminderSoon", { reference: c.reference, time: time(c.doctor.user.locale) }, `/doctor/consultations/${c.id}`);
    sent += 2;
  }
  return sent;
}

/** Requests left unanswered: a reminder to the doctor at 24 h, an urgent admin alert at 48 h. */
export async function nudgeDoctors(now = new Date()): Promise<number> {
  let count = 0;
  const late = await db.consultation.findMany({
    where: { status: "REQUESTED", doctorNudgedAt: null, createdAt: { lt: new Date(now.getTime() - NUDGE_AFTER_HOURS * HOUR) } },
    include: { slot: true, doctor: { include: { user: true } } },
  });
  for (const c of late) {
    const res = await db.consultation.updateMany({ where: { id: c.id, doctorNudgedAt: null }, data: { doctorNudgedAt: now } });
    if (!res.count) continue;
    await sendTemplate(c.doctor.user, "doctorNudge", { reference: c.reference, date: formatDateTime(c.slot.startsAt, toLocale(c.doctor.user.locale)) }, "/doctor");
    count++;
  }
  const escalate = await db.consultation.findMany({
    where: { status: "REQUESTED", adminAlertedAt: null, createdAt: { lt: new Date(now.getTime() - ESCALATE_AFTER_HOURS * HOUR) } },
    include: { doctor: { include: { user: true } } },
  });
  for (const c of escalate) {
    const res = await db.consultation.updateMany({ where: { id: c.id, adminAlertedAt: null }, data: { adminAlertedAt: now } });
    if (!res.count) continue;
    await db.alert.create({
      data: { kind: "noAnswer", severity: "urgent", consultationId: c.id, doctorId: c.doctorId, message: `${c.reference}: Dr ${c.doctor.user.lastName} has not answered for 48 h` },
    });
    count++;
  }
  return count;
}

/** Urgent alerts also reach the admins by email / WhatsApp, once each. */
export async function notifyUrgentAlerts(): Promise<number> {
  const alerts = await db.alert.findMany({ where: { severity: "urgent", resolvedAt: null }, orderBy: { createdAt: "asc" }, take: 20 });
  if (!alerts.length) return 0;
  const done = new Set(
    (await db.notificationLog.findMany({ where: { template: "adminAlert", target: { in: alerts.map((a) => a.id) } }, select: { target: true } })).map((l) => l.target),
  );
  const fresh = alerts.filter((a) => !done.has(a.id));
  if (!fresh.length) return 0;
  const admins = await db.user.findMany({ where: { role: "ADMIN", active: true } });
  for (const a of fresh) {
    await db.notificationLog.create({ data: { channel: "job", template: "adminAlert", target: a.id, status: "sent" } });
    for (const admin of admins) await sendTemplate(admin, "adminAlert", { message: a.message }, "/admin");
  }
  return fresh.length;
}

/** From 18:00, each agent receives tomorrow's arrivals, operations and departures. */
export async function sendAgentPlanning(now = new Date()): Promise<void> {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Tunis", hour: "2-digit", hourCycle: "h23" }).format(now));
  if (hour < PLANNING_HOUR) return;
  await oncePerDay("agentPlanning", now, async () => {
    const tomorrow = addDayKey(tunisDayKey(now), 1);
    const from = new Date(`${tomorrow}T00:00:00+01:00`);
    const to = addDays(from, 1);
    const agents = await db.user.findMany({ where: { role: "AGENT", active: true } });
    for (const agent of agents) {
      const bookings = await db.booking.findMany({
        where: {
          agentId: agent.id,
          status: { in: ["PAID", "IN_PROGRESS"] },
          OR: [{ arrivalDate: { gte: from, lt: to } }, { departureDate: { gte: from, lt: to } }, { slot: { startsAt: { gte: from, lt: to } } }],
        },
        include: { patient: true, slot: true },
      });
      if (!bookings.length) continue;
      const locale = toLocale(agent.locale);
      const t = getT(locale);
      const lines = bookings.map((b) => {
        const what =
          b.arrivalDate && b.arrivalDate >= from && b.arrivalDate < to
            ? t("scan.arrival")
            : b.departureDate && b.departureDate >= from && b.departureDate < to
              ? t("scan.departure")
              : `${t("ticket.appointment")} ${formatTime(b.slot.startsAt, locale)}`;
        return `${b.patient.firstName} ${b.patient.lastName} (${b.reference}) · ${what}${b.flightNumber ? ` · ${b.flightNumber}` : ""}`;
      });
      await sendTemplate(agent, "agentPlanning", { date: formatDate(from, locale), list: lines.join(" ; ") }, "/scan");
    }
  });
}

/** Everything the 5-minute cron does. Each part is idempotent. */
export async function runScheduledJobs(now = new Date()) {
  const expired = await expireOverdueBookings(now);
  const reminders = await sendReminders(now);
  const nudges = await nudgeDoctors(now);
  const alerts = await notifyUrgentAlerts();
  await sendAgentPlanning(now);
  let slots = 0;
  await oncePerDay("scheduleSync", now, async () => {
    slots = await syncAllSchedules();
  });
  return { expired, reminders, nudges, alerts, slots };
}
