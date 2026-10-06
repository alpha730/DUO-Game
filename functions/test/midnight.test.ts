// Day 8: daily rules across IST midnight with a fake server clock (emulator-only `_emulator/clock`):
// caught-today and the daily 4 reset at 00:00 IST, favourite streak +1 on the next day, a missed day
// resets it (level kept), and a real 10-day streak reaches MAX + 1000 once.
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { GetMyStateOutput, SetFavoritesInput, StartAttemptOutput, SubmitAttemptOutput } from "../src/shared/types";
import { adb, CAMPUS, cleanupApps, DEFAULT_PINS, istToday, newPlayer, pinQuestions } from "./helpers";

type Player = Awaited<ReturnType<typeof newPlayer>>;
const DAY = 86_400_000;
const clock = adb.doc("_emulator/clock");
const FAV = ["lingo-2018", "lingo-2017"];

/** Midnight IST that starts `date` (YYYY-MM-DD), in epoch ms. */
const istMidnight = (date: string) => Date.parse(`${date}T00:00:00+05:30`);
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** Moves the server clock to `ms` (the offset is fixed, so time keeps running from there). */
const setClock = (ms: number) => clock.set({ offsetMs: ms - Date.now() });

const N = istToday();
// Our own question for the two favourites (answer: option 0), pinned for every day of the test.
const KEEN = { type: "meaning", word: "keen", options: ["eager", "sad", "slow", "late"], correctIndex: 0 };
const useTestChallenges = () => pinQuestions({ ...DEFAULT_PINS, ...Object.fromEntries(FAV.map((l) => [l, KEEN])) });

afterEach(() => clock.delete());
afterAll(async () => {
  await clock.delete();
  await pinQuestions();
  await cleanupApps();
});

const start = (p: Player, lingoId: string) => p.call<object, StartAttemptOutput>("startAttempt")({ lingoId, ...CAMPUS });
async function win(p: Player, lingoId: string) {
  const a = await start(p, lingoId);
  return p.call<object, SubmitAttemptOutput>("submitAttempt")({ attemptId: a.attemptId, choice: 0 });
}
const state = (p: Player) => p.call<object, GetMyStateOutput>("getMyState")({});
const catchDoc = async (p: Player, l = "lingo-2018") => (await adb.doc(`users/${p.uid}/catches/${l}`).get()).data()!;

describe("across IST midnight (fake server clock)", () => {
  it("caught-today and the daily 4 reset at 00:00 IST; favourite streak +1; missed day resets it, level kept", async () => {
    await useTestChallenges();
    const p = await newPlayer();
    // Day N, 23:58 IST: first catches of both, then pick them as favourites.
    await setClock(istMidnight(addDays(N, 1)) - 120_000);
    await win(p, FAV[0]);
    await win(p, FAV[1]);
    await p.call<SetFavoritesInput>("setFavorites")({ lingoIds: FAV });
    await expect(start(p, FAV[0])).rejects.toMatchObject({ details: { code: "already-tried" } });
    expect((await state(p)).attemptsLeft).toBe(2);

    // Day N+1, 00:00:30 IST: a new day — catchable again, 4 attempts, favourite streak day 1.
    await setClock(istMidnight(addDays(N, 1)) + 30_000);
    const s = await state(p);
    expect(s.today).toBe(addDays(N, 1));
    expect(s.attemptsLeft).toBe(4);
    const d1 = await win(p, FAV[0]);
    expect(d1).toMatchObject({ result: "won", favStreak: 1 });
    expect(d1.pointsAdded).toBe(20 + d1.speedBonus);
    expect((await adb.doc(`users/${p.uid}`).get()).data()).toMatchObject({ dayStreak: 2, lastPlayDate: addDays(N, 1) });

    // Day N+2 caught too (streak 2) → then skip N+3 → N+4 starts again at day 1, level kept.
    await setClock(istMidnight(addDays(N, 2)) + 3_600_000);
    expect(await win(p, FAV[0])).toMatchObject({ favStreak: 2 });
    await adb.doc(`users/${p.uid}/catches/${FAV[0]}`).update({ level: 2 }); // pretend it had levelled
    await setClock(istMidnight(addDays(N, 4)) + 3_600_000);
    const after = await win(p, FAV[0]);
    expect(after).toMatchObject({ favStreak: 1, newLevel: 2 });
    expect(after.pointsAdded).toBe(20 + after.speedBonus);
    expect((await adb.doc(`users/${p.uid}`).get()).data()!.dayStreak).toBe(1); // missed a winning day
  }, 60_000);

  it("a real 10-day favourite streak: Level 2 at day 3, Level 3 at day 6, MAX + 1000 at day 10 (once)", async () => {
    await useTestChallenges();
    const p = await newPlayer();
    await setClock(istMidnight(N) + 10 * 3_600_000);
    await win(p, FAV[0]);
    await win(p, FAV[1]);
    await p.call<SetFavoritesInput>("setFavorites")({ lingoIds: FAV });

    const seen: Array<{ day: number; streak?: number; level: unknown; base: number; max: boolean }> = [];
    for (let day = 1; day <= 11; day++) {
      await setClock(istMidnight(addDays(N, day)) + 9 * 3_600_000);
      const o = await win(p, FAV[0]);
      const max = o.bonuses.some((b) => b.kind === "max");
      seen.push({ day, streak: o.favStreak, level: o.newLevel, base: o.pointsAdded - o.speedBonus - (max ? 1000 : 0), max });
    }
    expect(seen.map((s) => s.streak)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(seen.map((s) => s.level)).toEqual([1, 1, 2, 2, 2, 3, 3, 3, 3, "MAX", "MAX"]);
    expect(seen.map((s) => s.base)).toEqual([20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 200]); // capped at 200
    expect(seen.map((s) => s.max)).toEqual([false, false, false, false, false, false, false, false, false, true, false]);
    expect(await catchDoc(p)).toMatchObject({ level: "MAX", maxBonusGiven: true, favStreak: 11 });
    expect((await adb.doc(`users/${p.uid}`).get()).data()!.dayStreak).toBe(12);
  }, 120_000);

  it("production ignores the clock doc: no offset → today is the real IST date", async () => {
    const p = await newPlayer();
    expect((await state(p)).today).toBe(N);
  });
});
