import { describe, expect, it } from "vitest";
import { addDays, istDate, isYesterday } from "./date";

describe("istDate", () => {
  it("is the same IST day at 23:59 IST", () => {
    // 2026-10-10 23:59 IST = 18:29 UTC
    expect(istDate(new Date("2026-10-10T18:29:00Z"))).toBe("2026-10-10");
  });
  it("rolls over at 00:01 IST", () => {
    // 2026-10-11 00:01 IST = 18:31 UTC on the 10th
    expect(istDate(new Date("2026-10-10T18:31:00Z"))).toBe("2026-10-11");
  });
  it("rolls over at exactly 00:00 IST", () => {
    expect(istDate(new Date("2026-10-09T18:30:00Z"))).toBe("2026-10-10");
    expect(istDate(new Date("2026-10-09T18:29:59.999Z"))).toBe("2026-10-09");
  });
  it("accepts epoch millis", () => {
    expect(istDate(Date.parse("2026-10-22T06:30:00Z"))).toBe("2026-10-22"); // 12:00 IST
  });
  it("handles month and year boundaries", () => {
    expect(istDate(new Date("2026-10-31T18:30:00Z"))).toBe("2026-11-01");
    expect(istDate(new Date("2026-12-31T18:30:00Z"))).toBe("2027-01-01");
  });
});

describe("addDays / isYesterday", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
  it("detects yesterday", () => {
    expect(isYesterday("2026-10-10", "2026-10-11")).toBe(true);
    expect(isYesterday("2026-09-30", "2026-10-01")).toBe(true);
    expect(isYesterday("2026-10-11", "2026-10-11")).toBe(false);
    expect(isYesterday("2026-10-09", "2026-10-11")).toBe(false);
    expect(isYesterday(null, "2026-10-11")).toBe(false);
  });
});
