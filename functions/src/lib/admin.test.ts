import { describe, expect, it } from "vitest";
import { parseConfigPatch } from "./admin";

const IST = (s: string) => Date.parse(`${s}+05:30`);
const range = { startAt: IST("2026-10-10T00:00:00"), lockAt: IST("2026-10-22T12:00:00") };
const meaning = { type: "meaning", word: "keen", options: ["eager", "sad", "slow", "late"], correctIndex: 0 };

describe("parseConfigPatch", () => {
  it("accepts valid edits", () => {
    expect(parseConfigPatch({ locked: true, rules: { attemptsPerDay: 5, speakPassRatio: 0.75 } }, range)).toEqual({
      patch: { locked: true, rules: { attemptsPerDay: 5, speakPassRatio: 0.75 } },
    });
    const two = [
      { name: " Campus A ", lat: 26.78, lng: 75.82, radiusM: 600 },
      { name: "Campus B", lat: 26.83, lng: 75.82, radiusM: 500 },
    ];
    expect(parseConfigPatch({ campuses: two }, range)).toEqual({ patch: { campuses: [{ ...two[0], name: "Campus A" }, two[1]] } });
    expect(parseConfigPatch({ lockAt: range.lockAt + 3_600_000 }, range)).toEqual({ patch: { lockAt: range.lockAt + 3_600_000 } });
  });

  it("rejects bad edits", () => {
    const ok = { name: "A", lat: 26.78, lng: 75.82, radiusM: 500 };
    for (const bad of [
      { foo: 1 },
      { startAt: range.lockAt }, // start must be before lock
      { lockAt: range.startAt - 1 },
      { startAt: "tomorrow" },
      { locked: "yes" },
      { campusLat: 26.78 }, // old single-campus fields are gone
      { campuses: [] },
      { campuses: {} },
      { campuses: [ok, ok] }, // same name twice
      { campuses: [ok, ok, ok, ok, ok].map((c, i) => ({ ...c, name: `C${i}` })) }, // more than 4
      { campuses: [{ ...ok, name: "" }] },
      { campuses: [{ ...ok, lat: 91 }] },
      { campuses: [{ ...ok, lng: "75" }] },
      { campuses: [{ ...ok, radiusM: 10 }] },
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
