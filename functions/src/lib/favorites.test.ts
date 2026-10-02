import { describe, expect, it } from "vitest";
import { planFavorites } from "./favorites";

const caught = new Set(["a", "b", "c", "d"]);
const plan = (current: string[], changesLeft: number, requested: unknown) =>
  planFavorites({ current, changesLeft, requested, caught, count: 2 });

describe("planFavorites", () => {
  it("first pick is free", () => {
    expect(plan([], 1, ["a", "b"])).toEqual({ favorites: ["a", "b"], favoriteChangesLeft: 1, resetStreak: ["a", "b"], changed: true });
  });
  it("needs exactly 2 different Lingos", () => {
    for (const bad of [["a"], ["a", "b", "c"], ["a", "a"], "ab", [1, 2], null]) {
      expect(plan([], 1, bad)).toEqual({ error: "bad-input" });
    }
  });
  it("only caught Lingos", () => {
    expect(plan([], 1, ["a", "z"])).toEqual({ error: "not-caught" });
  });
  it("one change: resets the replaced and the new favourite, keeps the other", () => {
    expect(plan(["a", "b"], 1, ["a", "c"])).toEqual({ favorites: ["a", "c"], favoriteChangesLeft: 0, resetStreak: ["b", "c"], changed: true });
  });
  it("second change is rejected", () => {
    expect(plan(["a", "c"], 0, ["a", "d"])).toEqual({ error: "no-changes" });
  });
  it("re-sending the same pair (any order) uses no change", () => {
    expect(plan(["a", "b"], 0, ["b", "a"])).toEqual({ favorites: ["a", "b"], favoriteChangesLeft: 0, resetStreak: [], changed: false });
  });
  it("swapping both counts as one change and resets all four", () => {
    expect(plan(["a", "b"], 1, ["c", "d"])).toMatchObject({ favoriteChangesLeft: 0, resetStreak: ["a", "b", "c", "d"] });
  });
});
