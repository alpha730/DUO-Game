import { describe, expect, it } from "vitest";
import { missingChallenges, parseChallengeUpload, parseConfigPatch } from "./admin";

const IST = (s: string) => Date.parse(`${s}+05:30`);
const range = { startAt: IST("2026-10-10T00:00:00"), lockAt: IST("2026-10-22T12:00:00") };
const lingos = new Set(["lingo-2016", "lingo-2017"]);
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

describe("parseChallengeUpload", () => {
  it("accepts valid rows on the game's first and last day", () => {
    const out = parseChallengeUpload(
      [
        { date: "2026-10-10", lingoId: "lingo-2016", ...meaning },
        { date: "2026-10-22", lingoId: "lingo-2017", type: "speak", phrase: "Ten years of learning together." },
      ],
      range,
      lingos,
    );
    expect(out).toEqual({
      docs: [
        { id: "2026-10-10_lingo-2016", doc: meaning },
        { id: "2026-10-22_lingo-2017", doc: { type: "speak", phrase: "Ten years of learning together." } },
      ],
    });
  });

  it("reports every bad row and writes nothing", () => {
    const out = parseChallengeUpload(
      [
        { date: "2026-10-09", lingoId: "lingo-2016", ...meaning }, // before the start
        { date: "2026-10-23", lingoId: "lingo-2016", ...meaning }, // after the lock
        { date: "2026-02-30", lingoId: "lingo-2016", ...meaning },
        { date: "2026-10-11", lingoId: "lingo-1999", ...meaning },
        { date: "2026-10-11", lingoId: "lingo-2016", ...meaning, options: ["a", "b", "c"] },
        { date: "2026-10-11", lingoId: "lingo-2016", ...meaning, correctIndex: 4 },
        { date: "2026-10-12", lingoId: "lingo-2016", ...meaning },
        { date: "2026-10-12", lingoId: "lingo-2016", ...meaning }, // duplicate
      ],
      range,
      lingos,
    );
    expect("errors" in out && out.errors.map((e) => e.row)).toEqual([1, 2, 3, 4, 5, 6, 8]);
    expect(parseChallengeUpload([], range, lingos)).toHaveProperty("errors");
    expect(parseChallengeUpload({}, range, lingos)).toHaveProperty("errors");
  });
});

describe("missingChallenges", () => {
  it("lists every day × Lingo without a challenge (13 days Oct 10–22)", () => {
    expect(missingChallenges(range, ["lingo-2016"], new Set())).toHaveLength(13);
    expect(missingChallenges(range, ["lingo-2016"], new Set(["2026-10-10_lingo-2016"]))[0]).toBe("2026-10-11_lingo-2016");
  });
});
