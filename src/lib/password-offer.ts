import "server-only";
import { db } from "./db";
import { randomToken } from "./tokens";

/** The patient sets a password whenever they like: the link in their emails stays valid a month. */
const OFFER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Accounts created by email code have no password, and do not need one. Their booking
 * emails offer to add one: returns the page path, or null when a password is already set.
 */
export async function passwordOfferPath(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.passwordHash) return null;
  if (user.inviteToken && user.inviteExpiresAt && user.inviteExpiresAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return `/reset/${user.inviteToken}?new=1`;
  }
  const token = randomToken(24);
  await db.user.update({ where: { id: user.id }, data: { inviteToken: token, inviteExpiresAt: new Date(Date.now() + OFFER_TTL_MS) } });
  return `/reset/${token}?new=1`;
}
