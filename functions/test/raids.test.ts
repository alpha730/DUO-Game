// Owl Raids against the emulators (PLAN 6.1, 6.4): adminCreateRaid + joinRaid, 20 joins → unlocked;
// the raid try (joined players only, once unlocked, one try, +150 + speed, collection only).
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import type {
  AdminCreateRaidInput,
  AdminCreateRaidOutput,
  ChallengeInput,
  JoinRaidInput,
  JoinRaidOutput,
  SetFavoritesInput,
  StartAttemptInput,
  StartAttemptOutput,
  SubmitAttemptInput,
  SubmitAttemptOutput,
} from "../src/shared/types";
import { adb, adminAuth, CAMPUS, cleanupApps, istToday, newPlayer } from "./helpers";

afterAll(cleanupApps);

type Player = Awaited<ReturnType<typeof newPlayer>>;
const join = (p: Player, raidId: string) => p.call<JoinRaidInput, JoinRaidOutput>("joinRaid")({ raidId, ...CAMPUS });

async function admin() {
  const a = await newPlayer({ profile: false });
  await adminAuth.setCustomUserClaims(a.uid, { role: "admin" });
  await a.auth.currentUser!.getIdToken(true);
  return a;
}
// The raid's own challenge: answer 1 (today's normal lingo-2018 challenge answers 0).
const RAID_CHALLENGE: ChallengeInput = {
  type: "question",
  prompt: "We ___ ten years!",
  options: ["celebrates", "are celebrating", "celebrating", "celebrate is"],
  correctIndex: 1,
};
const create = (a: Player, input: Partial<AdminCreateRaidInput>) =>
  a.call<Partial<AdminCreateRaidInput>, AdminCreateRaidOutput>("adminCreateRaid")({ challenge: RAID_CHALLENGE, ...input });
const start = (p: Player, input: Partial<StartAttemptInput>) =>
  p.call<object, StartAttemptOutput>("startAttempt")({ lingoId: "lingo-2018", ...CAMPUS, ...input });
const submit = (p: Player, input: SubmitAttemptInput) => p.call<SubmitAttemptInput, SubmitAttemptOutput>("submitAttempt")(input);
const userDoc = async (p: Player) => (await adb.doc(`users/${p.uid}`).get()).data()!;
const catchDoc = async (p: Player, lingoId = "lingo-2018") => (await adb.doc(`users/${p.uid}/catches/${lingoId}`).get()).data();
/** An active raid on poster 3 (lingo-2018) that unlocks with `minPlayers` joins. */
async function openRaid(minPlayers = 1) {
  return (await create(await admin(), { posterIndex: 2, lingoId: "lingo-2018", startAt: Date.now(), minPlayers })).raidId;
}

describe("Owl Raids", () => {
  it("20 concurrent joins → unlocked; joins count once each", async () => {
    const a = await admin();
    const { raidId } = await create(a, { posterIndex: 2, lingoId: "lingo-2018", startAt: Date.now() });
    const raid = (await adb.doc(`raids/${raidId}`).get()).data()!;
    expect(raid).toMatchObject({ posterIndex: 2, lingoId: "lingo-2018", minPlayers: 20, joined: 0, unlocked: false, status: "active" });
    expect(raid.endAt.toMillis() - raid.startAt.toMillis()).toBe(15 * 60_000);

    const players = await Promise.all(Array.from({ length: 20 }, () => newPlayer()));
    const first19 = await Promise.all(players.slice(0, 19).map((p) => join(p, raidId)));
    expect(first19.every((r) => r.unlocked === false)).toBe(true);
    expect(Math.max(...first19.map((r) => r.joined))).toBe(19);

    // Repeat join: no double count.
    await expect(join(players[0], raidId)).resolves.toEqual({ joined: 19, unlocked: false, tried: false });
    await expect(join(players[19], raidId)).resolves.toEqual({ joined: 20, unlocked: true, tried: false });
    expect((await adb.doc(`raids/${raidId}`).get()).data()).toMatchObject({ joined: 20, unlocked: true });
    expect((await adb.collection(`raids/${raidId}/players`).get()).size).toBe(20);
    // A late joiner after unlock still counts.
    await expect(join(await newPlayer(), raidId)).resolves.toEqual({ joined: 21, unlocked: true, tried: false });
  }, 120_000);

  it("can't join before the start or after the end", async () => {
    const a = await admin();
    const p = await newPlayer();
    const { raidId: later } = await create(a, { posterIndex: 2, lingoId: "lingo-2018", startAt: Date.now() + 3_600_000 });
    await expect(join(p, later)).rejects.toMatchObject({ details: { code: "raid-not-started" } });
    const { raidId: over } = await create(a, { posterIndex: 2, lingoId: "lingo-2018", startAt: Date.now() });
    await adb.doc(`raids/${over}`).update({ endAt: Timestamp.fromMillis(Date.now() - 1000) });
    await expect(join(p, over)).rejects.toMatchObject({ details: { code: "raid-ended" } });
  });

  it("validates raids and is admin-only", async () => {
    const a = await admin();
    await expect(create(a, { posterIndex: 5, lingoId: "lingo-2018", startAt: Date.now() })).rejects.toMatchObject({
      details: { code: "poster-mismatch" },
    });
    await expect(create(a, { posterIndex: 2, lingoId: "lingo-1999", startAt: Date.now() })).rejects.toMatchObject({
      details: { code: "unknown-lingo" },
    });
    const p = await newPlayer();
    await expect(create(p, { posterIndex: 2, lingoId: "lingo-2018", startAt: Date.now() })).rejects.toMatchObject({
      code: "functions/permission-denied",
    });
  });

  it("stores the raid's own challenge server-only and rejects a bad one", async () => {
    const raidId = await openRaid();
    expect((await adb.doc(`challenges/raid_${raidId}`).get()).data()).toEqual(RAID_CHALLENGE);
    const bad: ChallengeInput = { type: "meaning", word: "x", options: ["a", "b"], correctIndex: 0 };
    await expect(
      create(await admin(), { posterIndex: 2, lingoId: "lingo-2018", startAt: Date.now(), challenge: bad }),
    ).rejects.toMatchObject({ details: { code: "bad-challenge" } });
  });

  it("raid win: +150 + speed, first catch via the raid, outside the daily 4, never 'caught today'", async () => {
    const raidId = await openRaid();
    const p = await newPlayer();
    await expect(join(p, raidId)).resolves.toEqual({ joined: 1, unlocked: true, tried: false });
    const a = await start(p, { raidId });
    expect(a).toMatchObject({ type: "question", prompt: "We ___ ten years!", attemptsLeft: 4 });
    expect(a).not.toHaveProperty("correctIndex");
    const out = await submit(p, { attemptId: a.attemptId, choice: 1 });
    expect(out).toMatchObject({ result: "won", raid: true, bonuses: [], newLevel: 1 });
    expect(out.speedBonus).toBeGreaterThanOrEqual(10);
    expect(out.pointsAdded).toBe(150 + out.speedBonus);

    expect(await catchDoc(p)).toMatchObject({ timesCaught: 1, level: 1, lastCaughtDate: null, favStreak: 0 });
    const u = await userDoc(p);
    expect(u).toMatchObject({ points: out.pointsAdded, lingosCaught: 1, attemptsToday: 0, dayStreak: 0, lastPlayDate: null, wins: 1 });
    const log = await adb.collection("pointsLog").where("attemptId", "==", a.attemptId).get();
    const reasons = Object.fromEntries(log.docs.map((d) => [d.data().reason, d.data().amount]));
    expect(reasons).toEqual({ raid: 150, speed: out.speedBonus });

    // The normal catch of the same Lingo is still allowed today (a repeat catch now: +20).
    const n = await start(p, {});
    expect(n.attemptsLeft).toBe(3);
    const normal = await submit(p, { attemptId: n.attemptId, choice: 0 });
    expect(normal.pointsAdded).toBe(20 + normal.speedBonus);
    expect(await catchDoc(p)).toMatchObject({ timesCaught: 2, lastCaughtDate: istToday() });
    // …and the raid try is used.
    await expect(join(p, raidId)).resolves.toMatchObject({ tried: true });
    await expect(start(p, { raidId })).rejects.toMatchObject({ details: { code: "raid-tried" } });
  });

  it("raid win on a favourite: no streak, level, day-streak or 'caught today' change", async () => {
    const p = await newPlayer();
    for (const lingoId of ["lingo-2018", "lingo-2019"]) {
      const a = await start(p, { lingoId });
      expect(await submit(p, { attemptId: a.attemptId, choice: 0 })).toMatchObject({ result: "won" });
    }
    await p.call<SetFavoritesInput>("setFavorites")({ lingoIds: ["lingo-2018", "lingo-2019"] });
    const yesterday = new Date(Date.now() + 5.5 * 3600_000 - 86_400_000).toISOString().slice(0, 10);
    await adb.doc(`users/${p.uid}/catches/lingo-2018`).update({ favStreak: 4, level: 2, lastCaughtDate: yesterday });
    const before = await userDoc(p);

    const raidId = await openRaid();
    await join(p, raidId);
    const a = await start(p, { raidId });
    const out = await submit(p, { attemptId: a.attemptId, choice: 1 });
    expect(out).toMatchObject({ result: "won", newLevel: 2 });
    expect(out.favStreak).toBeUndefined();
    expect(out.pointsAdded).toBe(150 + out.speedBonus);
    expect(await catchDoc(p)).toMatchObject({ timesCaught: 2, level: 2, favStreak: 4, lastCaughtDate: yesterday });
    expect(await userDoc(p)).toMatchObject({
      attemptsToday: before.attemptsToday,
      dayStreak: before.dayStreak,
      lastPlayDate: before.lastPlayDate,
    });
  });

  it("one try per raid: a failed try uses it; non-joiners and locked raids are refused", async () => {
    const raidId = await openRaid(2);
    const p = await newPlayer();
    const outsider = await newPlayer();
    await join(p, raidId);
    await expect(start(p, { raidId })).rejects.toMatchObject({ details: { code: "raid-locked" } });
    await join(await newPlayer(), raidId); // 2/2 → unlocked
    await expect(start(outsider, { raidId })).rejects.toMatchObject({ details: { code: "not-joined" } });

    const a = await start(p, { raidId });
    expect(await submit(p, { attemptId: a.attemptId, choice: 0 })).toMatchObject({ result: "failed", pointsAdded: 0, raid: true });
    await expect(start(p, { raidId })).rejects.toMatchObject({ details: { code: "raid-tried" } });
    expect(await userDoc(p)).toMatchObject({ attemptsToday: 0, losses: 1, points: 0 });
    // A raid for another Lingo is unknown.
    await expect(start(p, { raidId, lingoId: "lingo-2019" })).rejects.toMatchObject({ code: "functions/not-found" });
  });

  it("no start after endAt, but a try started before endAt may finish after it", async () => {
    const raidId = await openRaid();
    const [early, late] = [await newPlayer(), await newPlayer()];
    await join(early, raidId);
    await join(late, raidId);
    const a = await start(early, { raidId });
    await adb.doc(`raids/${raidId}`).update({ endAt: Timestamp.fromMillis(Date.now() - 1000) });
    await expect(start(late, { raidId })).rejects.toMatchObject({ details: { code: "raid-ended" } });
    expect(await submit(early, { attemptId: a.attemptId, choice: 1 })).toMatchObject({ result: "won", raid: true });
  });
});
