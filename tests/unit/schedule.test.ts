import { describe, expect, it } from "vitest";
import { addDayKey, parseSchedule, scheduleStarts, weekdayOf } from "@/lib/schedule-rules";

describe("weekly schedule", () => {
  it("drops malformed and overlapping ranges", () => {
    const s = parseSchedule({ "1": [["09:00", "12:00"], ["11:00", "13:00"], ["14:00", "13:00"], ["x", "y"]], "9": [["09:00", "10:00"]] });
    expect(s).toEqual({ "1": [["09:00", "12:00"]] });
  });

  it("cuts ranges into consultations with a break, in Tunis time", () => {
    // 2026-10-05 is a Monday.
    expect(weekdayOf("2026-10-05")).toBe(1);
    const starts = scheduleStarts({ "1": [["09:00", "10:30"]] }, "2026-10-05", 1, 30, 10);
    expect(starts.map((d) => d.toISOString())).toEqual(["2026-10-05T08:00:00.000Z", "2026-10-05T08:40:00.000Z"]);
  });

  it("skips exception days and other weekdays", () => {
    const starts = scheduleStarts({ "1": [["09:00", "09:30"]] }, "2026-10-05", 14, 30, 0, [{ startsOn: "2026-10-05", endsOn: "2026-10-06" }]);
    expect(starts.map((d) => d.toISOString())).toEqual(["2026-10-12T08:00:00.000Z"]);
    expect(addDayKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});
