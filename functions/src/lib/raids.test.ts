import { describe, expect, it } from "vitest";
import { planRaid, raidPhase } from "./raids";

const ts = (ms: number) => ({ seconds: ms / 1000, nanoseconds: 0, toMillis: () => ms, toDate: () => new Date(ms) });
const now = 1_800_000_000_000;

describe("raidPhase", () => {
  const raid = { startAt: ts(now), endAt: ts(now + 15 * 60_000) };
  it("scheduled → active → ended by time", () => {
    expect(raidPhase(raid, now - 1)).toBe("scheduled");
    expect(raidPhase(raid, now)).toBe("active");
    expect(raidPhase(raid, now + 15 * 60_000 - 1)).toBe("active");
    expect(raidPhase(raid, now + 15 * 60_000)).toBe("ended");
  });
});

describe("planRaid", () => {
  const lingo = { posterIndex: 3 };
  it("defaults to a 15-minute window and 20 players", () => {
    expect(planRaid({ posterIndex: 3, lingoId: "lingo-2019", startAt: now }, lingo, now)).toEqual({
      posterIndex: 3,
      lingoId: "lingo-2019",
      startAt: now,
      endAt: now + 15 * 60_000,
      minPlayers: 20,
      status: "active",
    });
  });
  it("future start is scheduled", () => {
    expect(planRaid({ posterIndex: 3, lingoId: "x", startAt: now + 3_600_000 }, lingo, now)).toMatchObject({ status: "scheduled" });
  });
  it("rejects bad input, unknown Lingo, wrong poster, past start", () => {
    expect(planRaid({ posterIndex: 3, lingoId: "x" }, lingo, now)).toEqual({ error: "bad-input" });
    expect(planRaid({ posterIndex: 3, lingoId: "x", startAt: now, minutes: 0 }, lingo, now)).toEqual({ error: "bad-input" });
    expect(planRaid({ posterIndex: 3, lingoId: "x", startAt: now }, undefined, now)).toEqual({ error: "unknown-lingo" });
    expect(planRaid({ posterIndex: 4, lingoId: "x", startAt: now }, lingo, now)).toEqual({ error: "poster-mismatch" });
    expect(planRaid({ posterIndex: 3, lingoId: "x", startAt: now - 120_000 }, lingo, now)).toEqual({ error: "in-the-past" });
  });
});
