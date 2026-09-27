import { describe, expect, it } from "vitest";
import { computeQuote, computeStay, rangesOverlap } from "@/lib/pricing";
import { nextTrackingStep, trackingSequence } from "@/lib/tracking";
import { formatMoney, fromTunisLocal, parseMoneyToCents, tunisDayKey } from "@/lib/format";
import { bookingReference } from "@/lib/tokens";
import { rateLimit } from "@/lib/rate-limit";

describe("computeStay", () => {
  it("arrives the day before and leaves after the recovery nights", () => {
    const op = new Date("2026-10-15T08:00:00Z");
    const stay = computeStay({ operationDate: op, recoveryNights: 7 });
    expect(stay.nights).toBe(8);
    expect(stay.arrivalDate.toISOString()).toBe("2026-10-14T08:00:00.000Z");
    expect(stay.departureDate.toISOString()).toBe("2026-10-22T08:00:00.000Z");
  });
});

describe("computeQuote", () => {
  const base = { operationPrice: 500000, transportPricePerPerson: 8000, nights: 8 };

  it("charges only the operation when no option is chosen", () => {
    const q = computeQuote({ ...base, withTransport: false, companionsCount: 2, accommodation: null });
    expect(q).toMatchObject({ withTransport: false, transportPrice: 0, accommodationPrice: 0, totalAmount: 500000 });
  });

  it("charges transport per traveller", () => {
    const q = computeQuote({ ...base, withTransport: true, companionsCount: 2, accommodation: null });
    expect(q.transportPrice).toBe(24000);
    expect(q.totalAmount).toBe(524000);
  });

  it("always includes the transfer with accommodation", () => {
    const q = computeQuote({ ...base, withTransport: false, companionsCount: 1, accommodation: { pricePerNight: 6000 } });
    expect(q.withTransport).toBe(true);
    expect(q.transportPrice).toBe(16000);
    expect(q.accommodationPrice).toBe(48000);
    expect(q.totalAmount).toBe(564000);
  });
});

describe("rangesOverlap", () => {
  const d = (s: string) => new Date(s);
  it("detects overlaps and treats touching ranges as free", () => {
    expect(rangesOverlap(d("2026-01-01"), d("2026-01-05"), d("2026-01-04"), d("2026-01-08"))).toBe(true);
    expect(rangesOverlap(d("2026-01-01"), d("2026-01-05"), d("2026-01-05"), d("2026-01-08"))).toBe(false);
  });
});

describe("tracking", () => {
  it("skips lodging steps without accommodation", () => {
    expect(trackingSequence(false)).toEqual(["ARRIVED_AIRPORT", "AT_CLINIC", "OPERATED", "DEPARTED"]);
    expect(trackingSequence(true)).toHaveLength(6);
  });

  it("walks the sequence and stops at the end", () => {
    expect(nextTrackingStep(null, true)).toBe("ARRIVED_AIRPORT");
    expect(nextTrackingStep("ARRIVED_AIRPORT", true)).toBe("AT_ACCOMMODATION");
    expect(nextTrackingStep("ARRIVED_AIRPORT", false)).toBe("AT_CLINIC");
    expect(nextTrackingStep("OPERATED", false)).toBe("DEPARTED");
    expect(nextTrackingStep("DEPARTED", true)).toBeNull();
  });
});

describe("format helpers", () => {
  it("converts Tunisia local time (UTC+1) to UTC", () => {
    expect(fromTunisLocal("2026-10-15", "09:00").toISOString()).toBe("2026-10-15T08:00:00.000Z");
    expect(() => fromTunisLocal("15/10/2026", "9h")).toThrow();
  });

  it("computes the day as seen in Tunisia", () => {
    expect(tunisDayKey(new Date("2026-10-14T23:30:00Z"))).toBe("2026-10-15");
  });

  it("parses money input to cents", () => {
    expect(parseMoneyToCents("1500")).toBe(150000);
    expect(parseMoneyToCents("1 500,50")).toBe(150050);
    expect(parseMoneyToCents("12.345")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
  });

  it("formats money per locale", () => {
    expect(formatMoney(590000, "EUR", "en")).toBe("€5,900");
    expect(formatMoney(590000, "EUR", "fr").replace(/\s/g, " ")).toBe("5 900 €");
  });
});

describe("tokens and limits", () => {
  it("generates readable references", () => {
    const ref = bookingReference();
    expect(ref).toMatch(/^LD-[A-HJ-NP-Z2-9]{6}$/);
  });

  it("limits attempts per window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
  });
});
