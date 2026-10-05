// Points wired into submitAttempt (PLAN 4.2): one transaction updates user, catch doc and pointsLog.
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import type { StartAttemptOutput, SubmitAttemptInput, SubmitAttemptOutput } from "../src/shared/types";
import { adb, CAMPUS, cleanupApps, istToday, newPlayer } from "./helpers";

afterAll(cleanupApps);

type Player = Awaited<ReturnType<typeof newPlayer>>;
const start = (p: Player, lingoId: string) => p.call<object, StartAttemptOutput>("startAttempt")({ lingoId, ...CAMPUS });
const submit = (p: Player, input: SubmitAttemptInput) => p.call<SubmitAttemptInput, SubmitAttemptOutput>("submitAttempt")(input);
const user = async (p: Player) => (await adb.doc(`users/${p.uid}`).get()).data()!;
const catchDoc = async (p: Player, id: string) => (await adb.doc(`users/${p.uid}/catches/${id}`).get()).data();
const yesterday = () => new Date(Date.now() + 5.5 * 3600e3 - 86400e3).toISOString().slice(0, 10);
const MEANING = "lingo-2018"; // choice 0 wins
const QUESTION = "lingo-2019"; // choice 0 wins

describe("submitAttempt points (PLAN 4.2)", () => {
  it("first catch: +100 + speed, catch doc, user totals, points log", async () => {
    const p = await newPlayer();
    const a = await start(p, MEANING);
    const out = await submit(p, { attemptId: a.attemptId, choice: 0 });
    expect(out.result).toBe("won");
    expect(out.speedBonus).toBeGreaterThan(5);
    expect(out).toMatchObject({ pointsAdded: 100 + out.speedBonus, newTotal: 100 + out.speedBonus, newLevel: 1, needsFavorites: false, bonuses: [] });

    const u = await user(p);
    expect(u).toMatchObject({ points: out.newTotal, wins: 1, losses: 0, lingosCaught: 1, dayStreak: 1, lastPlayDate: istToday() });
    expect(u.pointsReachedAt).toBeInstanceOf(Timestamp);
    expect(await catchDoc(p, MEANING)).toMatchObject({ timesCaught: 1, lastCaughtDate: istToday(), level: 1, favStreak: 0, maxBonusGiven: false });

    const log = await adb.collection("pointsLog").where("uid", "==", p.uid).get();
    const byReason = Object.fromEntries(log.docs.map((d) => [d.data().reason, d.data().amount]));
    expect(byReason).toEqual({ firstCatch: 100, speed: out.speedBonus });
    expect(log.docs.every((d) => d.data().attemptId === a.attemptId)).toBe(true);
  });

  it("a caught Lingo can't be started again today; a 2nd Lingo asks for favourites", async () => {
    const p = await newPlayer();
    await submit(p, { attemptId: (await start(p, MEANING)).attemptId, choice: 0 });
    await expect(start(p, MEANING)).rejects.toMatchObject({ details: { code: "already-tried" } });
    const second = await submit(p, { attemptId: (await start(p, QUESTION)).attemptId, choice: 0 });
    expect(second.needsFavorites).toBe(true);
    expect((await user(p)).lingosCaught).toBe(2);
  });

  it("wrong answers give 0 points and count as losses", async () => {
    const p = await newPlayer();
    const out = await submit(p, { attemptId: (await start(p, MEANING)).attemptId, choice: 3 });
    expect(out).toMatchObject({ result: "failed", pointsAdded: 0 });
    expect(await user(p)).toMatchObject({ points: 0, wins: 0, losses: 1, lingosCaught: 0, dayStreak: 0 });
    expect(await catchDoc(p, MEANING)).toBeUndefined();
    expect((await adb.collection("pointsLog").where("uid", "==", p.uid).get()).size).toBe(0);
  });

  it("repeat non-favourite catch on a new day: +20 (+speed)", async () => {
    const p = await newPlayer();
    await adb.doc(`users/${p.uid}`).update({ points: 100, lingosCaught: 1, dayStreak: 1, lastPlayDate: yesterday() });
    await adb.doc(`users/${p.uid}/catches/${MEANING}`).set({
      firstCaughtAt: Timestamp.now(), timesCaught: 1, lastCaughtDate: yesterday(), level: 1, favStreak: 0, maxBonusGiven: false,
    });
    const out = await submit(p, { attemptId: (await start(p, MEANING)).attemptId, choice: 0 });
    expect(out.pointsAdded).toBe(20 + out.speedBonus);
    expect(out.newTotal).toBe(100 + out.pointsAdded);
    expect(await user(p)).toMatchObject({ dayStreak: 2, lingosCaught: 1 });
    expect(await catchDoc(p, MEANING)).toMatchObject({ timesCaught: 2, level: 1 });
  });

  it("favourite on day 3 of its streak: +60, Level 2", async () => {
    const p = await newPlayer();
    await adb.doc(`users/${p.uid}`).update({ lingosCaught: 2, favorites: [MEANING, QUESTION] });
    await adb.doc(`users/${p.uid}/catches/${MEANING}`).set({
      firstCaughtAt: Timestamp.now(), timesCaught: 3, lastCaughtDate: yesterday(), level: 1, favStreak: 2, maxBonusGiven: false,
    });
    const out = await submit(p, { attemptId: (await start(p, MEANING)).attemptId, choice: 0 });
    expect(out).toMatchObject({ favStreak: 3, newLevel: 2 });
    expect(out.pointsAdded).toBe(60 + out.speedBonus);
  });

  it("10th Lingo: all-10 bonus once; favourite day 10: MAX + 1000 once", async () => {
    const p = await newPlayer();
    await adb.doc(`users/${p.uid}`).update({ lingosCaught: 9, favorites: [QUESTION, "lingo-2016"] });
    const tenth = await submit(p, { attemptId: (await start(p, MEANING)).attemptId, choice: 0 });
    expect(tenth.bonuses).toEqual([{ kind: "allTen", points: 1000 }]);
    expect(tenth.pointsAdded).toBe(1100 + tenth.speedBonus);
    expect((await user(p)).allTenBonus).toBe(true);

    await adb.doc(`users/${p.uid}/catches/${QUESTION}`).set({
      firstCaughtAt: Timestamp.now(), timesCaught: 9, lastCaughtDate: yesterday(), level: 3, favStreak: 9, maxBonusGiven: false,
    });
    const max = await submit(p, { attemptId: (await start(p, QUESTION)).attemptId, choice: 0 });
    expect(max).toMatchObject({ newLevel: "MAX", favStreak: 10, bonuses: [{ kind: "max", points: 1000 }] });
    expect(max.pointsAdded).toBe(200 + 1000 + max.speedBonus);
    const log = await adb.collection("pointsLog").where("uid", "==", p.uid).get();
    expect(log.docs.filter((d) => d.data().reason === "allTen")).toHaveLength(1);
    expect(log.docs.filter((d) => d.data().reason === "max")).toHaveLength(1);
  });
});
