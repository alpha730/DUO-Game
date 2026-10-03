import { describe, expect, it } from "vitest";
import { DEFAULT_RULES as rules } from "../shared/types";
import { addDays } from "./date";
import { scoreCatch, scoreRaidCatch, type CatchInput } from "./points";
import { speedBonus } from "./speed";

const today = "2026-10-15";
const yesterday = addDays(today, -1);
const user = (over: Partial<CatchInput["user"]> = {}): CatchInput["user"] => ({
  favorites: [],
  lingosCaught: 0,
  allTenBonus: false,
  dayStreak: 0,
  lastPlayDate: null,
  points: 0,
  ...over,
});
const caught = (over: Partial<NonNullable<CatchInput["catchDoc"]>> = {}): NonNullable<CatchInput["catchDoc"]> => ({
  timesCaught: 1,
  lastCaughtDate: yesterday,
  level: 1,
  favStreak: 0,
  maxBonusGiven: false,
  ...over,
});
const run = (i: Partial<CatchInput>) =>
  scoreCatch({ user: user(), catchDoc: undefined, lingoId: "lingo-2016", today, rules, speedBonus: 0, ...i });

describe("speed bonus (from seconds left)", () => {
  const start = 1_000_000;
  it("goes 0…max and is clamped", () => {
    expect(speedBonus(start + 15_000, start, 15)).toBe(15); // instant answer = max
    expect(speedBonus(start + 15_000, start + 7_500, 15)).toBe(7);
    expect(speedBonus(start + 15_000, start + 15_000, 15)).toBe(0);
    expect(speedBonus(start + 15_000, start + 16_500, 15)).toBe(0); // in the grace → 0
    expect(speedBonus(start + 15_000, start - 9_000, 15)).toBe(15); // clamped to the timer
  });
  it("is added on top of the catch points", () => {
    const o = run({ speedBonus: 12 });
    expect(o.base).toBe(100);
    expect(o.speedBonus).toBe(12);
    expect(o.pointsAdded).toBe(112);
  });
});

describe("first catch", () => {
  it("+100, Level 1, counts the Lingo", () => {
    const o = run({});
    expect(o).toMatchObject({ base: 100, baseReason: "firstCatch", pointsAdded: 100, firstCatch: true, newLevel: 1, levelUp: false });
    expect(o.catchDoc).toEqual({ timesCaught: 1, lastCaughtDate: today, level: 1, favStreak: 0, maxBonusGiven: false });
    expect(o.user.lingosCaught).toBe(1);
  });
});

describe("non-favourite repeat", () => {
  it("+20 and levels by total catches (2 at 3, 3 at 6), no MAX", () => {
    let o = run({ catchDoc: caught({ timesCaught: 1 }) });
    expect(o).toMatchObject({ base: 20, baseReason: "repeatCatch", newLevel: 1, favorite: false });
    o = run({ catchDoc: caught({ timesCaught: 2 }) });
    expect(o).toMatchObject({ newLevel: 2, levelUp: true });
    o = run({ catchDoc: caught({ timesCaught: 5, level: 2 }) });
    expect(o).toMatchObject({ newLevel: 3, levelUp: true });
    o = run({ catchDoc: caught({ timesCaught: 12, level: 3 }) });
    expect(o).toMatchObject({ newLevel: 3, levelUp: false, bonuses: [] });
    expect(o.catchDoc.favStreak).toBe(0);
    expect(o.user.lingosCaught).toBe(0); // not a new Lingo
  });
});

describe("favourite streak", () => {
  it("day 1 → 10: 20 × day, levels 2 at 3, 3 at 6, MAX + 1000 at 10", () => {
    let doc = caught({ favStreak: 0, lastCaughtDate: "2026-10-01" });
    let day = today;
    const seen: Array<[number, number, unknown, number]> = [];
    for (let d = 1; d <= 10; d++) {
      const o = scoreCatch({ user: user({ favorites: ["lingo-2016", "lingo-2017"] }), catchDoc: doc, lingoId: "lingo-2016", today: day, rules, speedBonus: 0 });
      seen.push([o.catchDoc.favStreak, o.base, o.newLevel, o.bonuses.reduce((s, b) => s + b.points, 0)]);
      doc = { ...o.catchDoc };
      day = addDays(day, 1);
    }
    expect(seen.map((s) => s[0])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(seen.map((s) => s[1])).toEqual([20, 40, 60, 80, 100, 120, 140, 160, 180, 200]);
    expect(seen.map((s) => s[2])).toEqual([1, 1, 2, 2, 2, 3, 3, 3, 3, "MAX"]);
    expect(seen.map((s) => s[3])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1000]);
  });

  it("missed day resets the streak to day 1 but keeps the level", () => {
    const o = run({
      user: user({ favorites: ["lingo-2016", "lingo-2018"] }),
      catchDoc: caught({ favStreak: 7, level: 3, lastCaughtDate: addDays(today, -2) }),
    });
    expect(o).toMatchObject({ base: 20, newLevel: 3, favorite: true });
    expect(o.catchDoc.favStreak).toBe(1);
  });

  it("MAX is permanent and its bonus is paid once", () => {
    const o = run({
      user: user({ favorites: ["lingo-2016", "lingo-2018"] }),
      catchDoc: caught({ favStreak: 12, level: "MAX", maxBonusGiven: true }),
    });
    expect(o.newLevel).toBe("MAX");
    expect(o.bonuses).toEqual([]);
    expect(o.base).toBe(200); // capped at the day-10 rate
    const reset = run({
      user: user({ favorites: ["lingo-2016", "lingo-2018"] }),
      catchDoc: caught({ favStreak: 12, level: "MAX", maxBonusGiven: true, lastCaughtDate: "2026-10-01" }),
    });
    expect(reset).toMatchObject({ newLevel: "MAX", base: 20, bonuses: [] });
  });

  it("no streaks before favourites are chosen", () => {
    const o = run({ user: user({ favorites: [] }), catchDoc: caught({ timesCaught: 1 }) });
    expect(o).toMatchObject({ favorite: false, base: 20 });
    expect(o.catchDoc.favStreak).toBe(0);
  });
});

describe("all-10 bonus", () => {
  it("+1000 on the 10th different Lingo, once", () => {
    const tenth = run({ user: user({ lingosCaught: 9 }) });
    expect(tenth.bonuses).toEqual([{ kind: "allTen", points: 1000 }]);
    expect(tenth.pointsAdded).toBe(1100);
    expect(tenth.user).toMatchObject({ lingosCaught: 10, allTenBonus: true });
    const again = run({ user: user({ lingosCaught: 10, allTenBonus: true }), catchDoc: caught() });
    expect(again.bonuses).toEqual([]);
  });
});

describe("day streak (display only) + favourites prompt", () => {
  it("counts winning days in a row", () => {
    expect(run({ user: user({ dayStreak: 4, lastPlayDate: yesterday }) }).user.dayStreak).toBe(5);
    expect(run({ user: user({ dayStreak: 4, lastPlayDate: today }) }).user.dayStreak).toBe(4); // 2nd win today
    expect(run({ user: user({ dayStreak: 4, lastPlayDate: "2026-10-01" }) }).user.dayStreak).toBe(1);
  });
  it("asks for favourites after the 2nd different Lingo", () => {
    expect(run({ user: user({ lingosCaught: 0 }) }).needsFavorites).toBe(false);
    expect(run({ user: user({ lingosCaught: 1 }) }).needsFavorites).toBe(true);
    expect(run({ user: user({ lingosCaught: 1, favorites: ["a", "b"] }) }).needsFavorites).toBe(false);
  });
});

describe("Owl Raid catch", () => {
  const raid = (i: Partial<CatchInput>) =>
    scoreRaidCatch({ user: user(), catchDoc: undefined, lingoId: "lingo-2016", rules, speedBonus: 0, ...i });

  it("+150 + speed instead of the normal catch points", () => {
    const o = raid({ catchDoc: caught({ timesCaught: 3 }), speedBonus: 9 });
    expect(o).toMatchObject({ base: 150, pointsAdded: 159, speedBonus: 9, bonuses: [], firstCatch: false });
  });

  it("first catch via a raid: Level 1 catch doc, counts toward lingosCaught, never 'caught today'", () => {
    const o = raid({ user: user({ lingosCaught: 1 }) });
    expect(o.pointsAdded).toBe(150);
    expect(o.firstCatch).toBe(true);
    expect(o.catchDoc).toEqual({ timesCaught: 1, level: 1, lastCaughtDate: null, favStreak: 0, maxBonusGiven: false });
    expect(o.user.lingosCaught).toBe(2);
    expect(o.needsFavorites).toBe(true);
  });

  it("raises non-favourite levels by total catches, leaves favourites and the day streak alone", () => {
    expect(raid({ catchDoc: caught({ timesCaught: 2 }) }).catchDoc).toEqual({ timesCaught: 3, level: 2 });
    const fav = raid({ user: user({ favorites: ["lingo-2016"], lingosCaught: 2 }), catchDoc: caught({ timesCaught: 5, level: 2, favStreak: 4 }) });
    expect(fav.catchDoc).toEqual({ timesCaught: 6, level: 2 }); // no favStreak / lastCaughtDate / MAX change
    expect(fav.base).toBe(150);
    expect(fav.user).not.toHaveProperty("dayStreak");
  });

  it("completing all 10 via a raid gives the all-10 bonus once", () => {
    expect(raid({ user: user({ lingosCaught: 9 }) }).bonuses).toEqual([{ kind: "allTen", points: 1000 }]);
    expect(raid({ user: user({ lingosCaught: 10, allTenBonus: true }), catchDoc: caught() }).bonuses).toEqual([]);
  });
});
