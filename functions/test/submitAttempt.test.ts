// submitAttempt against the emulators (PLAN 3.2): scoring, expiry + grace, ownership.
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import type { StartAttemptOutput, SubmitAttemptInput, SubmitAttemptOutput } from "../src/shared/types";
import { adb, CAMPUS, cleanupApps, newPlayer } from "./helpers";

afterAll(cleanupApps);

type Player = Awaited<ReturnType<typeof newPlayer>>;
const start = (p: Player, lingoId: string) => p.call<object, StartAttemptOutput>("startAttempt")({ lingoId, ...CAMPUS });
const submit = (p: Player, input: SubmitAttemptInput) => p.call<SubmitAttemptInput, SubmitAttemptOutput>("submitAttempt")(input);
const attempt = async (id: string) => (await adb.doc(`attempts/${id}`).get()).data()!;
const user = async (p: Player) => (await adb.doc(`users/${p.uid}`).get()).data()!;

const L = { pronounce: "lingo-2016", speak: "lingo-2017", meaning: "lingo-2018", question: "lingo-2019" };

describe("submitAttempt", () => {
  it("wins each type with the right answer and records time + speed bonus", async () => {
    const p = await newPlayer();
    const answers: Array<[string, Partial<SubmitAttemptInput>]> = [
      [L.pronounce, { transcript: "program" }], // accept[] spelling
      [L.speak, { transcript: "practice every day and you will see the difference" }],
      [L.meaning, { choice: 0 }],
      [L.question, { choice: 0 }],
    ];
    for (const [lingoId, answer] of answers) {
      const a = await start(p, lingoId);
      const out = await submit(p, { attemptId: a.attemptId, ...answer });
      expect(out).toMatchObject({ result: "won" });
      expect(out.pointsAdded).toBe(100 + out.speedBonus); // first catch + speed bonus
      const doc = await attempt(a.attemptId);
      expect(doc.status).toBe("won");
      expect(doc.score).toBe(1);
      expect(doc.answerMs).toBeGreaterThanOrEqual(0);
      expect(doc.answerMs).toBeLessThan(10_000);
      expect(doc.receivedAt.toMillis()).toBeGreaterThanOrEqual(doc.startedAt.toMillis());
      // Answered within a few seconds of a 15–20 s timer.
      expect(doc.speedBonus).toBeGreaterThanOrEqual(10);
      expect(doc.speedBonus).toBeLessThanOrEqual(20);
    }
    const u = await user(p);
    expect(u).toMatchObject({ wins: 4, losses: 0 });
    expect(u.totalAnswerMs).toBeGreaterThanOrEqual(0);
  });

  it("fails wrong answers (0 speed bonus) and returns missed words for speak", async () => {
    const p = await newPlayer();
    const s = await start(p, L.speak);
    const out = await submit(p, { attemptId: s.attemptId, transcript: "practice every day" });
    expect(out).toMatchObject({ result: "failed", pointsAdded: 0, speedBonus: 0 });
    expect(out.missedWords).toEqual(["and", "you", "will", "see", "the", "difference"]);
    expect(await attempt(s.attemptId)).toMatchObject({ status: "failed", speedBonus: 0 });

    const m = await start(p, L.meaning);
    expect(await submit(p, { attemptId: m.attemptId, choice: 2 })).toMatchObject({ result: "failed" });
    const pr = await start(p, L.pronounce);
    expect(await submit(p, { attemptId: pr.attemptId, transcript: "programming" })).toMatchObject({ result: "failed" });
    expect(await user(p)).toMatchObject({ wins: 0, losses: 3 });
  });

  it("accepts an answer inside the 2 s grace", async () => {
    const p = await newPlayer();
    const a = await start(p, L.meaning);
    await adb.doc(`attempts/${a.attemptId}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    const out = await submit(p, { attemptId: a.attemptId, choice: 0 });
    expect(out.result).toBe("won");
    expect((await attempt(a.attemptId)).speedBonus).toBe(0); // no time left → no bonus
  });

  it("rejects a late answer and marks the attempt forfeit (counts as a loss)", async () => {
    const p = await newPlayer();
    const a = await start(p, L.meaning);
    await adb.doc(`attempts/${a.attemptId}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 2_500) });
    await expect(submit(p, { attemptId: a.attemptId, choice: 0 })).rejects.toMatchObject({
      code: "functions/deadline-exceeded",
      details: { code: "too-late" },
    });
    expect((await attempt(a.attemptId)).status).toBe("forfeit");
    expect(await user(p)).toMatchObject({ wins: 0, losses: 1 });
  });

  it("only answers once", async () => {
    const p = await newPlayer();
    const a = await start(p, L.question);
    await submit(p, { attemptId: a.attemptId, choice: 1 });
    await expect(submit(p, { attemptId: a.attemptId, choice: 0 })).rejects.toMatchObject({ details: { code: "not-open" } });
    expect((await attempt(a.attemptId)).status).toBe("failed");
  });

  it("refuses someone else's attempt and bad input without touching the attempt", async () => {
    const owner = await newPlayer();
    const thief = await newPlayer();
    const a = await start(owner, L.meaning);
    await expect(submit(thief, { attemptId: a.attemptId, choice: 0 })).rejects.toMatchObject({ code: "functions/permission-denied" });
    await expect(submit(owner, { attemptId: a.attemptId, choice: 7 })).rejects.toMatchObject({ code: "functions/invalid-argument" });
    await expect(submit(owner, { attemptId: a.attemptId, transcript: "x".repeat(501) })).rejects.toMatchObject({
      code: "functions/invalid-argument",
    });
    await expect(submit(owner, { attemptId: "nope" })).rejects.toMatchObject({ code: "functions/permission-denied" });
    expect((await attempt(a.attemptId)).status).toBe("open");
  });
});
