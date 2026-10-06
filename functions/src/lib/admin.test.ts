import { describe, expect, it } from "vitest";
import { parseConfigPatch } from "./admin";

const IST = (s: string) => Date.parse(`${s}+05:30`);
const range = { startAt: IST("2026-10-10T00:00:00"), lockAt: IST("2026-10-22T12:00:00") };
const meaning = { type: "meaning", word: "keen", options: ["eager", "sad", "slow", "late"], correctIndex: 0 };

describe("parseConfigPatch", () => {
  it("accepts valid edits", () => {
    expect(parseConfigPatch({ locked: true, campusRadiusM: 600, rules: { attemptsPerDay: 5, speakPassRatio: 0.75 } }, range)).toEqual({
      patch: { locked: true, campusRadiusM: 600, rules: { attemptsPerDay: 5, speakPassRatio: 0.75 } },
    });
    expect(parseConfigPatch({ lockAt: range.lockAt + 3_600_000 }, range)).toEqual({ patch: { lockAt: range.lockAt + 3_600_000 } });
  });

  it("rejects bad edits", () => {
    for (const bad of [
      { foo: 1 },
      { startAt: range.lockAt }, // start must be before lock
      { lockAt: range.startAt - 1 },
      { startAt: "tomorrow" },
      { locked: "yes" },
      { campusLat: 91 },
      { campusRadiusM: 10 },
      { rules: { nope: 1 } },
      { rules: { attemptsPerDay: -1 } },
      { rules: { attemptsPerDay: 2.5 } },
      { rules: { speakPassRatio: 1.5 } },
      { rules: [] },
    ]) {
      expect(parseConfigPatch(bad, range)).toHaveProperty("error");
    }
  });
});
