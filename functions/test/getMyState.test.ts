// getMyState against the emulators. Admin SDK plants server-only data (attempts, catches).
import { Timestamp } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GetMyStateOutput } from "../src/shared/types";
import { adb, cleanupApps, istToday, newPlayer } from "./helpers";

let p: Awaited<ReturnType<typeof newPlayer>> & { getMyState(): Promise<GetMyStateOutput>; completeProfile(d: unknown): Promise<unknown> };
beforeAll(async () => {
  const base = await newPlayer({ profile: false });
  p = { ...base, getMyState: () => base.call<object, GetMyStateOutput>("getMyState")({}), completeProfile: base.call("completeProfile") };
});
afterAll(cleanupApps);

describe("getMyState", () => {
  it("works before the profile exists", async () => {
    const s = await p.getMyState();
    expect(s.user).toBeNull();
    expect(s.catches).toEqual([]);
    expect(s.today).toBe(istToday());
    expect(s.attemptsLeft).toBe(4);
    expect(Math.abs(s.serverNow - Date.now())).toBeLessThan(10_000);
  });

  it("returns the user, catches and attempts left", async () => {
    await p.completeProfile({ name: "State Tester" });
    await adb.doc(`users/${p.uid}`).update({ attemptsToday: 3, attemptsDate: istToday() });
    await adb.doc(`users/${p.uid}/catches/lingo-2019`).set({
      firstCaughtAt: Timestamp.now(),
      timesCaught: 2,
      lastCaughtDate: istToday(),
      level: 1,
      favStreak: 0,
      maxBonusGiven: false,
    });
    const s = await p.getMyState();
    expect(s.user).toMatchObject({ name: "State Tester", attemptsToday: 3, favorites: [], favoriteChangesLeft: 1 });
    expect(typeof s.user!.createdAt).toBe("number");
    expect(s.attemptsLeft).toBe(1);
    expect(s.catches).toEqual([expect.objectContaining({ lingoId: "lingo-2019", timesCaught: 2, lastCaughtDate: istToday() })]);
  });

  it("resets attempts from a previous day", async () => {
    await adb.doc(`users/${p.uid}`).update({ attemptsToday: 4, attemptsDate: "2026-01-01" });
    const s = await p.getMyState();
    expect(s.attemptsLeft).toBe(4);
    expect(s.user!.attemptsToday).toBe(0);
  });

  it("auto-forfeits the caller's open attempts only", async () => {
    const mine = adb.collection("attempts").doc();
    const theirs = adb.collection("attempts").doc();
    const base = { lingoId: "lingo-2016", date: istToday(), type: "speak", startedAt: Timestamp.now(), expiresAt: Timestamp.now() };
    await mine.set({ ...base, uid: p.uid, status: "open" });
    await theirs.set({ ...base, uid: "someone-else", status: "open" });
    await p.getMyState();
    expect((await mine.get()).data()?.status).toBe("forfeit");
    expect((await adb.doc(`users/${p.uid}`).get()).data()?.losses).toBe(1); // a forfeit is a loss
    expect((await theirs.get()).data()?.status).toBe("open");
  });

  it("rejects signed-out callers", async () => {
    const app = initializeApp({ projectId: "demo-decade-hunt", apiKey: "demo-key" }, `anon-${Date.now()}`);
    const fns = getFunctions(app, "asia-south1");
    connectFunctionsEmulator(fns, "127.0.0.1", 5001);
    await expect(httpsCallable(fns, "getMyState")({})).rejects.toMatchObject({ code: "functions/unauthenticated" });
  });
});
