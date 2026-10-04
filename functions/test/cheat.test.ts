// Day 8 cheating tests: calling the functions from the console with fake data. The server must ignore
// any client-sent points/times/flags and accept only well-formed answers.
import { afterAll, describe, expect, it } from "vitest";
import type { StartAttemptOutput, SubmitAttemptOutput } from "../src/shared/types";
import { adb, CAMPUS, cleanupApps, newPlayer } from "./helpers";

afterAll(cleanupApps);

type Player = Awaited<ReturnType<typeof newPlayer>>;
const start = (p: Player, data: object) => p.call<object, StartAttemptOutput>("startAttempt")({ ...CAMPUS, ...data });
const submit = (p: Player, data: object) => p.call<object, SubmitAttemptOutput>("submitAttempt")(data);
const user = async (p: Player) => (await adb.doc(`users/${p.uid}`).get()).data()!;

describe("cheating with fake data", () => {
  it("startAttempt ignores a client-sent expiry, attempts count or status", async () => {
    const p = await newPlayer();
    const before = Date.now();
    const a = await start(p, { lingoId: "lingo-2018", expiresAt: before + 3_600_000, attemptsLeft: 99, status: "won", date: "2030-01-01" });
    expect(a.expiresAt - before).toBeLessThanOrEqual(16_000); // meaning = 15 s, server-set
    expect(a.attemptsLeft).toBe(3);
    const doc = (await adb.doc(`attempts/${a.attemptId}`).get()).data()!;
    expect(doc).toMatchObject({ status: "open", lingoId: "lingo-2018" });
    expect(doc.date).not.toBe("2030-01-01");
    expect((await user(p)).attemptsToday).toBe(1);
  });

  it("submitAttempt ignores client points / speed bonus / timestamps / 'won'", async () => {
    const p = await newPlayer();
    const a = await start(p, { lingoId: "lingo-2018" });
    const out = await submit(p, {
      attemptId: a.attemptId,
      choice: 0,
      points: 99_999,
      pointsAdded: 99_999,
      speedBonus: 999,
      receivedAt: 0,
      result: "won",
      bonuses: [{ kind: "allTen", points: 1000 }],
    });
    expect(out.pointsAdded).toBe(100 + out.speedBonus);
    expect(out.speedBonus).toBeLessThanOrEqual(15);
    expect(out.bonuses).toEqual([]);
    expect((await user(p)).points).toBe(out.pointsAdded);
  });

  it("a wrong answer can't be dressed up as right", async () => {
    const p = await newPlayer();
    // Wrong choice + 'result: won' → failed.
    const a = await start(p, { lingoId: "lingo-2019" });
    expect(await submit(p, { attemptId: a.attemptId, choice: 3, result: "won" })).toMatchObject({ result: "failed", pointsAdded: 0 });
    // A transcript for a choice challenge (no choice) → failed, not a free pass.
    const b = await start(p, { lingoId: "lingo-2018" });
    expect(await submit(p, { attemptId: b.attemptId, transcript: "eager unwilling all of them 0 1 2 3" })).toMatchObject({ result: "failed" });
    // Malformed answers are rejected outright (and the attempt stays open until it expires).
    const c = await start(p, { lingoId: "lingo-2016" });
    for (const bad of [{ choice: "0" }, { choice: -1 }, { choice: 4 }, { choice: 1.5 }, { transcript: "x".repeat(501) }, { transcript: 42 }]) {
      await expect(submit(p, { attemptId: c.attemptId, ...bad })).rejects.toMatchObject({ code: "functions/invalid-argument" });
    }
    expect((await adb.doc(`attempts/${c.attemptId}`).get()).data()!.status).toBe("open");
    expect((await user(p)).points).toBe(0);
  });

  it("can't answer, forfeit or replay another player's attempt; can't guess attempt ids", async () => {
    const [p, q] = [await newPlayer(), await newPlayer()];
    const a = await start(p, { lingoId: "lingo-2018" });
    await expect(submit(q, { attemptId: a.attemptId, choice: 0 })).rejects.toMatchObject({ code: "functions/permission-denied" });
    await expect(submit(q, { attemptId: "does-not-exist", choice: 0 })).rejects.toMatchObject({ code: "functions/permission-denied" });
    await expect(submit(q, { attemptId: "../users/x", choice: 0 })).rejects.toMatchObject({ code: "functions/invalid-argument" });
    expect(await submit(p, { attemptId: a.attemptId, choice: 0 })).toMatchObject({ result: "won" });
    await expect(submit(p, { attemptId: a.attemptId, choice: 0 })).rejects.toMatchObject({ details: { code: "not-open" } });
  });

  it("can't pick favourites, join raids or start attempts with made-up ids", async () => {
    const p = await newPlayer();
    await expect(p.call("setFavorites")({ lingoIds: ["lingo-2018", "lingo-2019"] })).rejects.toMatchObject({ code: "functions/invalid-argument" });
    await expect(p.call("joinRaid")({ raidId: "fake", ...CAMPUS })).rejects.toMatchObject({ code: "functions/not-found" });
    await expect(start(p, { lingoId: "lingo-2099" })).rejects.toMatchObject({ code: "functions/not-found" });
    await expect(start(p, { lingoId: "lingo-2018", lat: "26.78", lng: 75.82 })).rejects.toMatchObject({ details: { code: "bad-location" } });
    expect((await user(p)).attemptsToday).toBe(0);
  });

  it("players can't call admin functions or give themselves a role", async () => {
    const p = await newPlayer();
    for (const name of ["adminSetConfig", "adminUpsertChallenges", "adminCreateRaid", "adminStats", "lockGame"]) {
      await expect(p.call(name)({ locked: true, rules: { firstCatchPoints: 1e6 } })).rejects.toMatchObject({ code: "functions/permission-denied" });
    }
    expect((await adb.doc("config/game").get()).data()!.locked).toBe(false);
  });
});
