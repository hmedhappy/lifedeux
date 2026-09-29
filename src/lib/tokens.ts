import { randomBytes } from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human friendly booking reference, e.g. LD-7K3P9Q. */
export function bookingReference(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length];
  return `LD-${out}`;
}

/** Short code a super-doctor shares in their referral link, e.g. DR-K7P3QX9A. */
export function referralCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (const b of bytes) out += REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length];
  return `DR-${out}`;
}
