import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "./db";

export const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

/** Codes are stored hashed with the app secret, never in clear. */
export function hashLoginCode(email: string, code: string): string {
  return createHash("sha256").update(`${email.toLowerCase()}:${code}:${process.env.AUTH_SECRET ?? ""}`).digest("hex");
}

export async function createLoginCode(email: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.loginCode.create({
    data: { email: email.toLowerCase(), codeHash: hashLoginCode(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000) },
  });
  return code;
}

/**
 * Checks the latest valid code for this email. `consume: false` validates without
 * using it up (used when a new patient still has to give their name).
 */
export async function checkLoginCode(email: string, code: string, consume = true): Promise<"ok" | "invalid" | "expired"> {
  const row = await db.loginCode.findFirst({
    where: { email: email.toLowerCase(), usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.expiresAt < new Date() || row.attempts >= MAX_ATTEMPTS) return "expired";
  const expected = Buffer.from(row.codeHash, "hex");
  const given = Buffer.from(hashLoginCode(email, code.replace(/\s/g, "")), "hex");
  const match = expected.length === given.length && timingSafeEqual(expected, given);
  if (!match) {
    await db.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return "invalid";
  }
  if (consume) await db.loginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return "ok";
}
