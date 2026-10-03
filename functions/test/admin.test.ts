// Admin functions against the emulators (PLAN 7.2): config, challenge upload, lock, stats.
import { afterAll, describe, expect, it } from "vitest";
import type { AdminSetConfigInput, AdminStatsOutput, AdminUpsertChallengesInput, StartAttemptOutput } from "../src/shared/types";
import { adb, adminAuth, CAMPUS, cleanupApps, istToday, newPlayer } from "./helpers";

afterAll(cleanupApps);

type Player = Awaited<ReturnType<typeof newPlayer>>;
async function admin() {
  const a = await newPlayer();
  await adminAuth.setCustomUserClaims(a.uid, { role: "admin" });
  await a.auth.currentUser!.getIdToken(true);
  return a;
}
const config = async () => (await adb.doc("config/game").get()).data()!;
/** Runs `fn` and puts config/game back afterwards (other suites rely on the seeded config). */
async function keepingConfig(fn: () => Promise<void>) {
  const before = await config();
  try {
    await fn();
  } finally {
    await adb.doc("config/game").set(before);
  }
}
const setConfig = (a: Player, d: AdminSetConfigInput) => a.call<AdminSetConfigInput>("adminSetConfig")(d);

describe("admin", () => {
  it("is admin-only", async () => {
    const p = await newPlayer();
    for (const name of ["adminSetConfig", "adminUpsertChallenges", "adminStats", "lockGame"]) {
      await expect(p.call(name)({})).rejects.toMatchObject({ code: "functions/permission-denied" });
    }
  });

  it("edits config: rules merge, campus, times; bad edits are refused", async () => {
    const a = await admin();
    await keepingConfig(async () => {
      const before = await config();
      await setConfig(a, { campusRadiusM: 750, rules: { attemptsPerDay: 5 } });
      const after = await config();
      expect(after.campusRadiusM).toBe(750);
      expect(after.rules).toEqual({ ...before.rules, attemptsPerDay: 5 }); // other rules untouched
      const lockAt = before.lockAt.toMillis() + 3_600_000;
      await setConfig(a, { lockAt });
      expect((await config()).lockAt.toMillis()).toBe(lockAt);
      await expect(setConfig(a, { startAt: lockAt + 1 })).rejects.toMatchObject({ details: { code: "bad-config" } });
      await expect(setConfig(a, { rules: { nope: 1 } as never })).rejects.toMatchObject({ details: { code: "bad-config" } });
    });
  });

  it("lockGame closes every player function at once, and reopens", async () => {
    const a = await admin();
    const p = await newPlayer();
    await keepingConfig(async () => {
      await expect(a.call("lockGame")({ locked: true })).resolves.toEqual({ locked: true });
      await expect(p.call<object, StartAttemptOutput>("startAttempt")({ lingoId: "lingo-2018", ...CAMPUS })).rejects.toMatchObject({
        details: { code: "locked" },
      });
      await a.call("lockGame")({ locked: false });
      await expect(p.call<object, StartAttemptOutput>("startAttempt")({ lingoId: "lingo-2018", ...CAMPUS })).resolves.toHaveProperty("attemptId");
    });
  });

  it("uploads challenges all-or-nothing, with row errors", async () => {
    const a = await admin();
    const up = (d: AdminUpsertChallengesInput) => a.call<AdminUpsertChallengesInput, { written: number }>("adminUpsertChallenges")(d);
    const today = istToday();
    const id = `${today}_lingo-2025`;
    const saved = (await adb.doc(`challenges/${id}`).get()).data();
    try {
      const good = { date: today, lingoId: "lingo-2025", type: "speak" as const, phrase: "Ten years together." };
      const bad = { date: today, lingoId: "lingo-2024", type: "meaning" as const, word: "x", options: ["a", "b", "c"], correctIndex: 5 };
      const err = await up({ challenges: [good, bad, { ...good, date: "1999-01-01" }] }).catch((e) => e);
      expect(err.details.code).toBe("bad-rows");
      expect(err.details.errors.map((e: { row: number }) => e.row)).toEqual([2, 3]);
      expect((await adb.doc(`challenges/${id}`).get()).data()).toEqual(saved); // nothing written

      await expect(up({ challenges: [good] })).resolves.toEqual({ written: 1 });
      expect((await adb.doc(`challenges/${id}`).get()).data()).toEqual({ type: "speak", phrase: "Ten years together." });
    } finally {
      if (saved) await adb.doc(`challenges/${id}`).set(saved);
    }
  });

  it("stats: users, attempts and wins today, missing challenges", async () => {
    const a = await admin();
    const s0 = await a.call<object, AdminStatsOutput>("adminStats")({});
    const p = await newPlayer();
    const at = await p.call<object, StartAttemptOutput>("startAttempt")({ lingoId: "lingo-2018", ...CAMPUS });
    await p.call("submitAttempt")({ attemptId: at.attemptId, choice: 0 });
    const s1 = await a.call<object, AdminStatsOutput>("adminStats")({});
    expect(s1.today).toBe(istToday());
    expect(s1.users).toBe(s0.users + 1);
    expect(s1.attemptsToday).toBe(s0.attemptsToday + 1);
    expect(s1.winsToday).toBe(s0.winsToday + 1);
    expect(s1.missingCount).toBeGreaterThanOrEqual(0);
    expect(s1.missingChallenges.length).toBeLessThanOrEqual(20);
  });
});
