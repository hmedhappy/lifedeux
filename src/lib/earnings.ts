import "server-only";
import { db } from "./db";
import { fromTunisLocal } from "./format";
import { localized, type Locale } from "./i18n";

/** The month after "YYYY-MM". */
export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** [start, end) of a "YYYY-MM" month in Tunis time. */
export function monthRange(month: string): { from: Date; to: Date } {
  return { from: fromTunisLocal(`${month}-01`, "00:00"), to: fromTunisLocal(`${nextMonth(month)}-01`, "00:00") };
}

export type Act = { id: string; at: Date; label: string; who: string; fee: number };

/** Paid acts of a doctor in a period: completed (or no-show) consultations and operations done. */
export async function doctorActs(doctorId: string, from: Date, to: Date, locale: Locale, consultLabel: string): Promise<Act[]> {
  const [consults, ops] = await Promise.all([
    db.consultation.findMany({
      where: { doctorId, status: { in: ["COMPLETED", "NO_SHOW"] }, slot: { startsAt: { gte: from, lt: to } } },
      include: { slot: true, patient: { select: { firstName: true, lastName: true } } },
    }),
    db.booking.findMany({
      where: { doctorId, status: { in: ["IN_PROGRESS", "COMPLETED"] }, slot: { startsAt: { gte: from, lt: to } } },
      include: { slot: true, operation: true, patient: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  return [
    ...consults.map((c) => ({ id: c.id, at: c.slot.startsAt, label: consultLabel, who: `${c.patient.firstName} ${c.patient.lastName.charAt(0)}.`, fee: c.doctorFee })),
    ...ops.map((b) => ({ id: b.id, at: b.slot.startsAt, label: localized(b.operation, "name", locale), who: `${b.patient.firstName} ${b.patient.lastName.charAt(0)}.`, fee: b.doctorFee })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}
