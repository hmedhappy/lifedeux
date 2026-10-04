import "server-only";
import { db } from "./db";

/** A doctor sign-up link stays valid two weeks. */
export const DOCTOR_INVITE_TTL_DAYS = 14;

/** Valid, unused sign-up link, or null. */
export async function findDoctorInvite(token: string) {
  const invite = await db.doctorInvite.findUnique({ where: { token } });
  return invite && !invite.usedAt && invite.expiresAt > new Date() ? invite : null;
}
