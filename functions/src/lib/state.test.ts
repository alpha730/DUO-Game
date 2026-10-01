import { describe, expect, it } from "vitest";
import { attemptsLeft, attemptsUsedToday, catchView, userView } from "./state";

const ts = (ms: number) => ({ seconds: ms / 1000, nanoseconds: 0, toMillis: () => ms, toDate: () => new Date(ms) });
const rules = { attemptsPerDay: 4 };

describe("attempts", () => {
  it("counts only today's attempts", () => {
    expect(attemptsUsedToday({ attemptsToday: 3, attemptsDate: "2026-10-10" }, "2026-10-10")).toBe(3);
    expect(attemptsUsedToday({ attemptsToday: 3, attemptsDate: "2026-10-09" }, "2026-10-10")).toBe(0);
    expect(attemptsUsedToday({ attemptsToday: 0, attemptsDate: null }, "2026-10-10")).toBe(0);
  });
  it("computes attempts left, never negative", () => {
    expect(attemptsLeft({ attemptsToday: 1, attemptsDate: "2026-10-10" }, "2026-10-10", rules)).toBe(3);
    expect(attemptsLeft({ attemptsToday: 4, attemptsDate: "2026-10-09" }, "2026-10-10", rules)).toBe(4);
    expect(attemptsLeft({ attemptsToday: 6, attemptsDate: "2026-10-10" }, "2026-10-10", rules)).toBe(0);
  });
});

describe("views", () => {
  it("resets a stale attemptsToday and converts timestamps", () => {
    const v = userView(
      { attemptsToday: 4, attemptsDate: "2026-10-09", createdAt: ts(1000), name: "A" } as never,
      "2026-10-10",
    );
    expect(v).toMatchObject({ attemptsToday: 0, createdAt: 1000, name: "A" });
  });
  it("adds the lingoId to catches", () => {
    expect(
      catchView("lingo-2016", {
        firstCaughtAt: ts(5),
        timesCaught: 1,
        lastCaughtDate: "2026-10-10",
        level: 1,
        favStreak: 0,
        maxBonusGiven: false,
      }),
    ).toEqual({
      lingoId: "lingo-2016",
      firstCaughtAt: 5,
      timesCaught: 1,
      lastCaughtDate: "2026-10-10",
      level: 1,
      favStreak: 0,
      maxBonusGiven: false,
    });
  });
});
