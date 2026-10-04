// Day 8 cheat flags (flag only, never block): too-fast answers, "too good to be true" players, the
// admin's Suspicious players list and the top-20 export with flags.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AdminPlayersOutput, StartAttemptOutput, SubmitAttemptOutput } from "../src/shared/types";
import { adb, adminAuth, CAMPUS, cleanupApps, newPlayer } from "./helpers";

afterAll(cleanupApps);

type Player = Awaited<ReturnType<typeof newPlayer>>;
const start = (p: Player, lingoId: string) => p.call<object, StartAttemptOutput>("startAttempt")({ lingoId, ...CAMPUS });
const submit = (p: Player, data: object) => p.call<object, SubmitAttemptOutput>("submitAttempt")(data);
const attempt = async (id: string) => (await adb.doc(`attempts/${id}`).get()).data()!;
const user = async (p: Player) => (await adb.doc(`users/${p.uid}`).get()).data()!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function admin() {
  const a = await newPlayer();
  await adminAuth.setCustomUserClaims(a.uid, { role: "admin" });
  await a.auth.currentUser!.getIdToken(true);
  return a;
}

describe("cheat flags", () => {
  // Timing tests: load startAttempt/submitAttempt once first (an emulator cold start takes > 1 s).
  beforeAll(async () => {
    const w = await newPlayer();
    const a = await start(w, "lingo-2018");
    await submit(w, { attemptId: a.attemptId, choice: 0 });
  }, 60_000);

  it("a too-fast choice answer is flagged, still scored normally; a human-speed one isn't", async () => {
    const p = await newPlayer();
    const a = await start(p, "lingo-2018"); // meaning
    const out = await submit(p, { attemptId: a.attemptId, choice: 0 });
    expect(out.result).toBe("won"); // never blocked
    expect(out.pointsAdded).toBe(100 + out.speedBonus);
    const doc = await attempt(a.attemptId);
    expect(doc.answerMs).toBeLessThan(800);
    expect(doc).toMatchObject({ flagged: true });
    expect(doc.flagReason).toMatch(/^meaning answered in \d+ ms \(< 800 ms\)$/);
    expect((await user(p)).flags).toBe(1);

    const b = await start(p, "lingo-2019"); // question
    await sleep(1000);
    await submit(p, { attemptId: b.attemptId, choice: 0 });
    expect(await attempt(b.attemptId)).not.toHaveProperty("flagged");
    expect((await user(p)).flags).toBe(1);
  });

  it("a voice answer under 1.5 s is flagged even when wrong", async () => {
    const p = await newPlayer();
    const a = await start(p, "lingo-2017"); // speak
    expect(await submit(p, { attemptId: a.attemptId, transcript: "nothing like it" })).toMatchObject({ result: "failed" });
    expect((await attempt(a.attemptId)).flagReason).toMatch(/^speak answered in/);
    expect((await user(p)).flags).toBe(1);
  });

  it("'too good to be true' (≥ 10 wins, ≥ 95 %, avg < 3 s) is set and cleared as answers come in", async () => {
    const p = await newPlayer();
    await adb.doc(`users/${p.uid}`).update({ wins: 9, losses: 0, totalAnswerMs: 9 * 2000 });
    const a = await start(p, "lingo-2018");
    await sleep(900); // not flagged as too fast
    await submit(p, { attemptId: a.attemptId, choice: 0 });
    expect(await user(p)).toMatchObject({ wins: 10, suspect: true });
    const b = await start(p, "lingo-2019");
    await sleep(900);
    await submit(p, { attemptId: b.attemptId, choice: 3 }); // wrong → 10/11 = 91 %
    expect(await user(p)).toMatchObject({ losses: 1, suspect: false });
  });

  it("admin lists suspicious players (flags or suspect) on request; players can't", async () => {
    const [fast, good, clean] = [await newPlayer(), await newPlayer(), await newPlayer()];
    await adb.doc(`users/${fast.uid}`).update({ flags: 3, wins: 4, losses: 1, totalAnswerMs: 4 * 900 });
    await adb.doc(`users/${good.uid}`).update({ suspect: true, wins: 12, losses: 0, totalAnswerMs: 12 * 2500 });
    const a = await admin();
    const { rows } = await a.call<object, AdminPlayersOutput>("adminSuspicious")({});
    const byUid = new Map(rows.map((r) => [r.uid, r]));
    expect(byUid.get(fast.uid)).toMatchObject({ flags: 3, wins: 4, accuracy: 0.8, avgAnswerMs: 900, name: "Test Player" });
    expect(byUid.get(fast.uid)!.email).toMatch(/@example\.com$/);
    expect(byUid.get(good.uid)).toMatchObject({ suspect: true, accuracy: 1, avgAnswerMs: 2500, flags: 0 });
    expect(byUid.has(clean.uid)).toBe(false);
    await expect(clean.call("adminSuspicious")({})).rejects.toMatchObject({ code: "functions/permission-denied" });
  });

  it("top-20 export: leaderboard order, with email and the flags column", async () => {
    const p = await newPlayer();
    await adb.doc(`users/${p.uid}`).update({ points: 9_999_999, flags: 2, wins: 5, losses: 0, totalAnswerMs: 5000 });
    try {
      const a = await admin();
      const out = await a.call<object, AdminPlayersOutput>("adminTop20")({});
      expect(out.rows.length).toBeGreaterThan(0);
      expect(out.rows.length).toBeLessThanOrEqual(20);
      expect(out.rows[0]).toMatchObject({ rank: 1, uid: p.uid, points: 9_999_999, flags: 2 });
      expect(out.rows.map((r) => r.rank)).toEqual(out.rows.map((_, i) => i + 1));
      expect(out.rows.every((r) => typeof r.flags === "number" && r.email.includes("@"))).toBe(true);
      await expect(p.call("adminTop20")({})).rejects.toMatchObject({ code: "functions/permission-denied" });
    } finally {
      await adb.doc(`users/${p.uid}`).update({ points: 0 });
    }
  });
});
