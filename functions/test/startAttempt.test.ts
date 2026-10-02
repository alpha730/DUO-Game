// startAttempt against the emulators (PLAN 3.1).
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import type { StartAttemptInput, StartAttemptOutput } from "../src/shared/types";
import { adb, CAMPUS, cleanupApps, istToday, newPlayer, patchConfig } from "./helpers";

afterAll(cleanupApps);

const start = (p: Awaited<ReturnType<typeof newPlayer>>, lingoId: string, extra: Partial<StartAttemptInput> = {}) =>
  p.call<StartAttemptInput, StartAttemptOutput>("startAttempt")({ lingoId, ...CAMPUS, ...extra });

// Seed: 2016 pronounce, 2017 speak, 2018 meaning, 2019 question (today).
const LINGO = { pronounce: "lingo-2016", speak: "lingo-2017", meaning: "lingo-2018", question: "lingo-2019" };

describe("startAttempt", () => {
  it("returns each challenge type without the answer, and records an open attempt", async () => {
    const p = await newPlayer();
    for (const [type, lingoId] of Object.entries(LINGO)) {
      const before = Date.now();
      const out = await start(p, lingoId);
      expect(out.type).toBe(type);
      const raw = JSON.stringify(out);
      expect(raw).not.toMatch(/accept|correctIndex/);
      expect(raw).not.toContain('"program"'); // the pronounce accept[] spelling
      if (type === "pronounce") expect(out).toMatchObject({ word: "programme" });
      if (type === "speak") expect(out.phrase).toMatch(/^Practice every day/);
      if (type === "meaning") expect(out).toMatchObject({ word: "reluctant", options: ["unwilling", "excited", "tired", "careful"] });
      if (type === "question") expect(out.prompt).toContain("___");
      const timer = { pronounce: 15, speak: 20, meaning: 15, question: 20 }[type]!;
      expect(out.expiresAt - out.serverNow).toBe(timer * 1000);
      expect(Math.abs(out.serverNow - before)).toBeLessThan(10_000);

      const attempt = (await adb.doc(`attempts/${out.attemptId}`).get()).data()!;
      expect(attempt).toMatchObject({ uid: p.uid, lingoId, date: istToday(), type, status: "open" });
      expect(attempt.expiresAt.toMillis()).toBe(out.expiresAt);
    }
  });

  it("counts attempts, closes the previous open attempt as a loss, and stops at 4", async () => {
    const p = await newPlayer();
    const a1 = await start(p, LINGO.speak);
    expect(a1.attemptsLeft).toBe(3);
    const a2 = await start(p, LINGO.meaning); // a1 still open → forfeited
    expect(a2.attemptsLeft).toBe(2);
    expect((await adb.doc(`attempts/${a1.attemptId}`).get()).data()!.status).toBe("forfeit");
    let user = (await adb.doc(`users/${p.uid}`).get()).data()!;
    expect(user).toMatchObject({ attemptsToday: 2, attemptsDate: istToday(), losses: 1 });

    await start(p, LINGO.question);
    await start(p, LINGO.pronounce);
    await expect(start(p, LINGO.speak)).rejects.toMatchObject({ details: { code: "no-attempts" } });
    user = (await adb.doc(`users/${p.uid}`).get()).data()!;
    expect(user.attemptsToday).toBe(4);
    // Only one attempt is ever open.
    const open = await adb.collection("attempts").where("uid", "==", p.uid).where("status", "==", "open").get();
    expect(open.size).toBe(1);
  });

  it("PLAN 4.3: won, failed and forfeited all count — the 5th attempt is rejected", async () => {
    const p = await newPlayer();
    const submit = p.call<object, unknown>("submitAttempt");
    await submit({ attemptId: (await start(p, LINGO.meaning)).attemptId, choice: 0 }); // won
    await submit({ attemptId: (await start(p, LINGO.question)).attemptId, choice: 3 }); // failed
    await start(p, LINGO.speak); // left open…
    await start(p, LINGO.pronounce); // …forfeited by this start; this one is open (4th)
    const err = await start(p, LINGO.question).catch((e) => e);
    expect(err).toMatchObject({ details: { code: "no-attempts" } });
    const u = (await adb.doc(`users/${p.uid}`).get()).data()!;
    expect(u).toMatchObject({ attemptsToday: 4, attemptsDate: istToday(), wins: 1, losses: 2 });
    expect((await adb.collection("attempts").where("uid", "==", p.uid).get()).size).toBe(4);
  });

  it("resets the daily count on a new IST day", async () => {
    const p = await newPlayer();
    await adb.doc(`users/${p.uid}`).update({ attemptsToday: 4, attemptsDate: "2026-01-01" });
    const out = await start(p, LINGO.speak);
    expect(out.attemptsLeft).toBe(3);
  });

  it("refuses a Lingo already caught today, but allows retrying one that was only failed", async () => {
    const p = await newPlayer();
    await adb.doc(`users/${p.uid}/catches/${LINGO.meaning}`).set({
      firstCaughtAt: Timestamp.now(), timesCaught: 1, lastCaughtDate: istToday(), level: 1, favStreak: 0, maxBonusGiven: false,
    });
    await expect(start(p, LINGO.meaning)).rejects.toMatchObject({ details: { code: "already-caught" } });
    await adb.doc(`users/${p.uid}/catches/${LINGO.meaning}`).update({ lastCaughtDate: "2026-01-01" });
    await expect(start(p, LINGO.meaning)).resolves.toMatchObject({ type: "meaning" });
  });

  it("rejects bad input, unknown Lingos, missing challenges and raids", async () => {
    const p = await newPlayer();
    await expect(start(p, "../users/x")).rejects.toMatchObject({ code: "functions/invalid-argument" });
    await expect(start(p, "lingo-1999")).rejects.toMatchObject({ code: "functions/not-found" });
    const ch = adb.doc(`challenges/${istToday()}_lingo-2025`);
    const saved = (await ch.get()).data();
    await ch.delete();
    try {
      await expect(start(p, "lingo-2025")).rejects.toMatchObject({ details: { code: "no-challenge" } });
    } finally {
      if (saved) await ch.set(saved);
    }
    await expect(start(p, LINGO.speak, { lat: 999 } as never)).rejects.toMatchObject({ details: { code: "bad-location" } });
    await expect(start(p, LINGO.speak, { raidId: "r1" })).rejects.toMatchObject({ details: { code: "no-raids" } });
    // None of these used an attempt.
    expect((await adb.doc(`users/${p.uid}`).get()).data()!.attemptsToday).toBe(0);
  });

  // Production refuses off-campus players (src/lib/geo.test.ts); the emulator only warns so the game
  // can be played from home.
  it("lets an off-campus player through on the emulator", async () => {
    const restore = await patchConfig({ campusRadiusM: 500 });
    try {
      const p = await newPlayer();
      await expect(start(p, LINGO.speak, { lat: 26.9124, lng: 75.7873 })).resolves.toMatchObject({ type: "speak" }); // city centre
    } finally {
      await restore();
    }
  });

  it("speech: false refuses voice challenges without using an attempt or revealing them (PLAN 3.10)", async () => {
    const p = await newPlayer();
    for (const lingoId of [LINGO.speak, LINGO.pronounce]) {
      const err = await start(p, lingoId, { speech: false }).catch((e) => e);
      expect(err).toMatchObject({ code: "functions/failed-precondition", details: { code: "needs-speech" } });
      expect(err.message).toContain("Open in Chrome or Safari for this Lingo");
      expect(JSON.stringify(err)).not.toMatch(/Practice every day|programme|program/);
    }
    const u = (await adb.doc(`users/${p.uid}`).get()).data()!;
    expect(u.attemptsToday).toBe(0);
    const attempts = await adb.collection("attempts").where("uid", "==", p.uid).get();
    expect(attempts.size).toBe(0);
    // Meaning and question still work without speech recognition.
    await expect(start(p, LINGO.meaning, { speech: false })).resolves.toMatchObject({ type: "meaning", attemptsLeft: 3 });
    await expect(start(p, LINGO.question, { speech: false })).resolves.toMatchObject({ type: "question", attemptsLeft: 2 });
  });

  it("is closed before start, after lock, and when locked", async () => {
    const p = await newPlayer();
    for (const patch of [
      { startAt: Timestamp.fromMillis(Date.now() + 86_400_000) },
      { lockAt: Timestamp.fromMillis(Date.now() - 1000) },
      { locked: true },
    ]) {
      const restore = await patchConfig(patch);
      try {
        await expect(start(p, LINGO.speak)).rejects.toMatchObject({ code: "functions/failed-precondition" });
      } finally {
        await restore();
      }
    }
  });

  it("requires sign-in and a profile", async () => {
    const noProfile = await newPlayer({ profile: false });
    await expect(start(noProfile, LINGO.speak)).rejects.toMatchObject({ details: { code: "no-profile" } });
  });
});
