// Admin functions against the emulators (PLAN 7.2): config, question-pool upload, lock, stats.
import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { AdminSetConfigInput, AdminStatsOutput, AdminUpsertQuestionsInput, AdminUpsertQuestionsOutput, StartAttemptOutput } from "../src/shared/types";
import { adb, adminAuth, CAMPUS, cleanupApps, istToday, newPlayer, setQuestionPool } from "./helpers";

const POOL = JSON.parse(readFileSync(new URL("../../scripts/content/question-pool-2026.json", import.meta.url), "utf8"));

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
    for (const name of ["adminSetConfig", "adminUpsertQuestions", "adminStats", "lockGame"]) {
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

  it("uploads the question pool all-or-nothing (replacing it), with row errors and counts", async () => {
    const a = await admin();
    const up = (d: AdminUpsertQuestionsInput) => a.call<AdminUpsertQuestionsInput, AdminUpsertQuestionsOutput>("adminUpsertQuestions")(d);
    const count = async () => (await adb.collection("questions").count().get()).data().count;
    try {
      const good = { id: "t-mean-1", level: "medium" as const, type: "meaning" as const, word: "keen", options: ["eager", "sad", "slow", "late"] as [string, string, string, string], correctIndex: 0 as const, explanation: "eager" };
      const say = { id: "t-pron-1", level: "hard" as const, type: "pronounce" as const, word: "grandiloquent", explanation: "pompous" };
      const bad = { ...good, id: "t-mean-2", options: ["a", "a", "b", "c"] as [string, string, string, string] };
      const err = await up({ questions: [good, bad, { ...good }] }).catch((e) => e);
      expect(err.details.code).toBe("bad-rows");
      expect(err.details.errors.map((e: { row: number }) => e.row)).toEqual([2, 3]); // bad options, duplicate id
      expect(await count()).toBe(456); // nothing written

      const out = await up({ questions: [good, say] });
      expect(out).toMatchObject({ written: 2, removed: 456 });
      expect(out.counts).toMatchObject({ "medium/meaning": 1, "hard/pronounce": 1, "medium/question": 0 });
      expect(await count()).toBe(2);
      expect((await adb.doc("questions/t-mean-1").get()).data()).toMatchObject({ word: "keen", correctIndex: 0, level: "medium" });
    } finally {
      await setQuestionPool(POOL); // other suites and local play use the real pool
    }
  });

  it("stats: users, attempts and wins today, question counts", async () => {
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
    expect(s1.questionTotal).toBe(456);
    expect(s1.questions).toEqual({
      "medium/meaning": 100,
      "medium/question": 100,
      "medium/pronounce": 30,
      "hard/meaning": 100,
      "hard/question": 96,
      "hard/pronounce": 30,
    });
  });
});
