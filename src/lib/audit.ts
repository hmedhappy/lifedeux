import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

/** Records a sensitive admin action (prices, refunds, payouts, doctor changes…). */
export async function audit(actorId: string, action: string, target?: string | null, data?: Prisma.InputJsonValue): Promise<void> {
  await db.auditLog.create({ data: { actorId, action, target: target ?? null, data } });
}

/** Refunds above this amount (in currency units) need the admin's password again. */
export const REFUND_REAUTH_THRESHOLD = 500;
