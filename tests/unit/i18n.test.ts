import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createT, getMessages, locales } from "@/lib/i18n";
import { signSession, verifySession } from "@/lib/session-token";

function flatten(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Keys built at runtime from enums or fixed lists. */
const DYNAMIC_KEYS = [
  ...["REQUESTED", "CONFIRMED", "REFUSED", "EXPIRED", "PAID", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => `status.${s}`),
  ...["ARRIVED_AIRPORT", "AT_ACCOMMODATION", "AT_CLINIC", "OPERATED", "RECOVERING", "DEPARTED"].map((s) => `tracking.${s}`),
  ...["FREE", "HELD", "BOOKED"].map((s) => `slotStatus.${s}`),
  ...["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"].map((s) => `paymentStatus.${s}`),
  ...["PATIENT", "DOCTOR", "ADMIN", "AGENT"].map((s) => `roles.${s}`),
  ...[0, 1, 2, 3, 4, 5, 6].map((d) => `weekdays.${d}`),
  "accType.APARTMENT",
  "accType.HOUSE",
  ...["requested", "confirmed", "options", "paid", "trip"].map((s) => `booking.journey.${s}`),
  ...["transfer", "stay", "tracking", "support"].map((s) => `doctor.included.${s}`),
  ...["care", "languages", "privacy"].flatMap((s) => [`home.facts.${s}.title`, `home.facts.${s}.text`]),
  ...["appointment", "transfer", "stay", "payment"].flatMap((s) => [`home.services.${s}.title`, `home.services.${s}.text`]),
  ...[1, 2, 3, 4, 5].flatMap((n) => [`home.steps.${n}.title`, `home.steps.${n}.text`]),
  ...["stripe", "konnect", "mock"].flatMap((s) => [`pay.providers.${s}.title`, `pay.providers.${s}.text`]),
  ...["invite", "reset", "requestReceived", "newRequest", "confirmed", "refused", "paid", "expired"].flatMap((s) =>
    ["subject", "title", "body", "cta"].map((f) => `email.${s}.${f}`),
  ),
];

describe("translations", () => {
  const fr = new Set(flatten(getMessages("fr")));

  it.each(locales)("%s has exactly the same keys as fr", (locale) => {
    const keys = new Set(flatten(getMessages(locale)));
    expect([...fr].filter((k) => !keys.has(k))).toEqual([]);
    expect([...keys].filter((k) => !fr.has(k))).toEqual([]);
  });

  it("defines every key used in the source code", () => {
    const used = new Set<string>(DYNAMIC_KEYS);
    for (const file of sourceFiles(join(__dirname, "../../src"))) {
      const code = readFileSync(file, "utf8");
      for (const m of code.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) used.add(m[1]);
      for (const m of code.matchAll(/\b(?:fail|ok)\(\s*"([a-zA-Z0-9_.]+)"/g)) used.add(m[1]);
      for (const m of code.matchAll(/return "(errors\.[a-zA-Z]+)"/g)) used.add(m[1]);
    }
    expect([...used].filter((k) => !fr.has(k))).toEqual([]);
  });

  it("keeps the same placeholders in every language", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const locale of locales) {
      const t = createT(getMessages(locale));
      const tf = createT(getMessages("fr"));
      for (const key of fr) {
        expect(placeholders(t(key)), `${locale}:${key}`).toBe(placeholders(tf(key)));
      }
    }
  });

  it("interpolates variables", () => {
    const t = createT(getMessages("en"));
    expect(t("doctors.experience", { n: 12 })).toBe("12 years of experience");
    expect(t("missing.key")).toBe("missing.key");
  });
});

describe("session token", () => {
  it("signs and verifies, and rejects tampering", async () => {
    process.env.AUTH_SECRET = "x".repeat(40);
    const token = await signSession({ sub: "user_1", role: "DOCTOR" });
    expect(await verifySession(token)).toEqual({ sub: "user_1", role: "DOCTOR" });
    const [h, p, s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), role: "ADMIN" })).toString("base64url");
    expect(await verifySession(`${h}.${forged}.${s}`)).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
});
