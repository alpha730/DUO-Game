// One-day event (Oct 22): 3 rounds replace days; 3 levels (Lv 1 → Lv 2 → MAX); favourites to MAX
// rank right after points, and both at MAX = qualified to win.
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, ONE_DAY_RULES, type CatchDoc, type GameRules } from "../shared/types";
import { isPreviousPeriod, isRoundKey, playPeriod } from "./date";
import { planFavorites } from "./favorites";
import { betweenRoundsMessage } from "./guards";
import { scoreCatch, type CatchInput } from "./points";
import { levelFor, streakDayFor } from "./questions";
import { compareStudents, isQualified, type RankInput } from "./rank";

const IST = (hhmm: string) => Date.parse(`2026-10-22T${hhmm}:00+05:30`);
const ts = (ms: number) => ({ toMillis: () => ms });
const config = {
  rounds: [
    { startAt: ts(IST("10:00")), endAt: ts(IST("11:30")) },
    { startAt: ts(IST("12:30")), endAt: ts(IST("14:00")) },
    { startAt: ts(IST("15:00")), endAt: ts(IST("16:00")) },
  ],
};
const rules: GameRules = { ...DEFAULT_RULES, ...ONE_DAY_RULES };
const R = (n: number) => `2026-10-22#R${n}`;

describe("playPeriod", () => {
  it("is the IST date without rounds", () => {
    expect(playPeriod(IST("10:30"), {})).toEqual({ key: "2026-10-22", round: null });
  });
  it("is the active round, else the next one, else the last", () => {
    expect(playPeriod(IST("09:00"), config).round).toMatchObject({ n: 1, of: 3, active: false });
    expect(playPeriod(IST("10:00"), config)).toMatchObject({ key: R(1), round: { n: 1, active: true } });
    expect(playPeriod(IST("11:30"), config)).toMatchObject({ key: R(2), round: { n: 2, active: false } });
    expect(playPeriod(IST("13:59"), config)).toMatchObject({ key: R(2), round: { n: 2, active: true } });
    expect(playPeriod(IST("15:30"), config)).toMatchObject({ key: R(3), round: { n: 3, active: true } });
    expect(playPeriod(IST("17:00"), config)).toMatchObject({ key: R(3), round: { n: 3, active: false } });
  });
  it("orders rounds by start time", () => {
    const shuffled = { rounds: [config.rounds[2], config.rounds[0], config.rounds[1]] };
    expect(playPeriod(IST("12:45"), shuffled).key).toBe(R(2));
  });
});

describe("isPreviousPeriod", () => {
  it("is the round before (same event) or the day before", () => {
    expect(isPreviousPeriod(R(1), R(2))).toBe(true);
    expect(isPreviousPeriod(R(1), R(3))).toBe(false);
    expect(isPreviousPeriod(R(2), R(2))).toBe(false);
    expect(isPreviousPeriod("2026-10-21", "2026-10-22")).toBe(true);
    expect(isPreviousPeriod("2026-10-21", R(1))).toBe(false);
    expect(isPreviousPeriod(null, R(1))).toBe(false);
    expect(isRoundKey(R(2))).toBe(true);
    expect(isRoundKey("2026-10-22")).toBe(false);
  });
});

describe("between rounds", () => {
  it("names the next round and its IST start", () => {
    expect(betweenRoundsMessage(config, IST("09:00"))?.message).toBe("Round 1 starts at 10:00. Get ready!");
    expect(betweenRoundsMessage(config, IST("12:00"))?.message).toBe("Round 2 starts at 12:30. Get ready!");
    expect(betweenRoundsMessage(config, IST("12:30"))).toBeNull();
    expect(betweenRoundsMessage(config, IST("16:30"))).toBeNull(); // after the last: the lock decides
    expect(betweenRoundsMessage({}, IST("12:00"))).toBeNull();
  });
});

// One player, one Duo, three rounds.
type Doc = NonNullable<CatchInput["catchDoc"]>;
const play = (round: number, doc: Doc | undefined, favorites: string[], favMaxCount = 0) =>
  scoreCatch({
    user: { favorites, lingosCaught: doc ? 2 : 1, allTenBonus: false, dayStreak: 0, lastPlayDate: null, points: 0, favMaxCount },
    catchDoc: doc,
    lingoId: "lingo-2016",
    today: R(round),
    rules,
    speedBonus: 0,
  });

describe("one-day levels and favourite streak", () => {
  it("favourite caught in all 3 rounds: Lv 1 → Lv 2 → MAX (+1000, favMaxCount +1)", () => {
    const r1 = play(1, undefined, []); // first catch, before favourites are picked
    expect(r1.catchDoc).toMatchObject({ level: 1, favStreak: 1, lastCaughtDate: R(1) });
    const r2 = play(2, r1.catchDoc as Doc, ["lingo-2016", "lingo-2017"]);
    expect(r2.catchDoc).toMatchObject({ level: 2, favStreak: 2 });
    expect(r2.base).toBe(100);
    const r3 = play(3, r2.catchDoc as Doc, ["lingo-2016", "lingo-2017"]);
    expect(r3.catchDoc).toMatchObject({ level: "MAX", favStreak: 3, maxBonusGiven: true });
    expect(r3.base).toBe(150);
    expect(r3.bonuses).toContainEqual({ kind: "max", points: 1000 });
    expect(r3.user.favMaxCount).toBe(1);
  });
  it("a missed round breaks the streak: no MAX that day", () => {
    const r1 = play(1, undefined, []);
    const r3 = play(3, r1.catchDoc as Doc, ["lingo-2016", "lingo-2017"]);
    expect(r3.catchDoc).toMatchObject({ favStreak: 1, level: 1 });
    expect(r3.user.favMaxCount).toBeUndefined();
  });
  it("a non-favourite reaches Lv 2 in a later round and never MAX", () => {
    const r1 = play(1, undefined, []);
    const r2 = play(2, r1.catchDoc as Doc, []);
    const r3 = play(3, r2.catchDoc as Doc, []);
    expect([r1.catchDoc.level, r2.catchDoc.level, r3.catchDoc.level]).toEqual([1, 2, 2]);
    expect(r3.bonuses.some((b) => b.kind === "max")).toBe(false);
  });
  it("level 3 is never given", () => {
    let doc: Doc | undefined;
    const seen = new Set<string>();
    for (const r of [1, 2, 3]) {
      doc = play(r, doc, ["lingo-2016"]).catchDoc as Doc;
      seen.add(String(doc.level));
    }
    expect(seen.has("3")).toBe(false);
  });
  it("a favourite asks Hard questions from its 2nd round in a row", () => {
    const c = { lastCaughtDate: R(1), favStreak: 1 } as Pick<CatchDoc, "lastCaughtDate" | "favStreak">;
    expect(levelFor(true, streakDayFor(true, c, R(2)), rules.hardFromStreakDay)).toBe("hard");
    expect(levelFor(true, streakDayFor(true, c, R(3)), rules.hardFromStreakDay)).toBe("medium");
    expect(levelFor(false, streakDayFor(false, c, R(2)), rules.hardFromStreakDay)).toBe("medium");
  });
});

describe("favourites pick (one-day event)", () => {
  it("the first pick keeps the streaks; no swaps", () => {
    const plan = planFavorites({
      current: [],
      changesLeft: 0,
      requested: ["a", "b"],
      caught: new Set(["a", "b"]),
      count: 2,
      keepStreaksOnFirstPick: true,
    });
    expect(plan).toMatchObject({ favorites: ["a", "b"], resetStreak: [] });
    expect(planFavorites({ current: ["a", "b"], changesLeft: 0, requested: ["a", "c"], caught: new Set(["a", "b", "c"]), count: 2 })).toEqual({
      error: "no-changes",
    });
  });
});

describe("tie-break: favourites at MAX", () => {
  const p = (uid: string, o: Partial<RankInput>): RankInput => ({
    uid,
    name: uid,
    points: 1000,
    wins: 10,
    losses: 0,
    totalAnswerMs: 50_000,
    pointsReachedAt: 1,
    ...o,
  });
  it("ranks right after points, before accuracy", () => {
    expect(compareStudents(p("a", { favMaxCount: 2, losses: 5 }), p("b", { favMaxCount: 1 }))).toBeLessThan(0);
    expect(compareStudents(p("a", { favMaxCount: 2, points: 999 }), p("b", { favMaxCount: 0 }))).toBeGreaterThan(0);
  });
  it("never ties", () => {
    expect(compareStudents(p("a", {}), p("b", {}))).not.toBe(0);
  });
  it("both favourites at MAX = qualified", () => {
    expect([isQualified(undefined), isQualified(1), isQualified(2)]).toEqual([false, false, true]);
  });
});
