// completeProfile against the emulators (PLAN 1.9): name only, verified email required.
import { signOut } from "firebase/auth";
import { afterAll, describe, expect, it } from "vitest";
import { adb, cleanupApps, newPlayer } from "./helpers";

afterAll(cleanupApps);

const user = async (uid: string) => (await adb.doc(`users/${uid}`).get()).data();

describe("completeProfile", () => {
  it("rejects an unverified email (no profile written)", async () => {
    const p = await newPlayer({ profile: false, verified: false });
    await expect(p.call("completeProfile")({ name: "Unverified Person" })).rejects.toMatchObject({
      code: "functions/failed-precondition",
      details: { code: "email-unverified" },
    });
    expect(await user(p.uid)).toBeUndefined();
  });

  it("creates the profile with SPEC §4 defaults: name + email only", async () => {
    const p = await newPlayer({ profile: false });
    await expect(p.call("completeProfile")({ name: "  Asha   Verma " })).resolves.toEqual({ ok: true });
    const u = await user(p.uid);
    expect(u).toMatchObject({
      name: "Asha Verma",
      email: p.auth.currentUser!.email,
      points: 0,
      attemptsToday: 0,
      attemptsDate: null,
      dayStreak: 0,
      lastPlayDate: null,
      lingosCaught: 0,
      allTenBonus: false,
      favorites: [],
      favoriteChangesLeft: 1,
      wins: 0,
      losses: 0,
      totalAnswerMs: 0,
      pointsReachedAt: null,
      profileDone: true,
    });
    for (const gone of ["dept", "year", "roll", "todayPoints", "streak"]) expect(u).not.toHaveProperty(gone);
  });

  it("ignores client-sent extras and rejects a second call", async () => {
    const p = await newPlayer({ profile: false });
    await p.call("completeProfile")({ name: "First Name", dept: "CSE", email: "spoof@evil.example" });
    const u = await user(p.uid);
    expect(u!.email).toBe(p.auth.currentUser!.email);
    expect(u).not.toHaveProperty("dept");
    await expect(p.call("completeProfile")({ name: "Second Name" })).rejects.toMatchObject({
      code: "functions/already-exists",
      details: { code: "profile-done" },
    });
    expect((await user(p.uid))!.name).toBe("First Name");
  });

  it("rejects a bad name", async () => {
    const p = await newPlayer({ profile: false });
    await expect(p.call("completeProfile")({ name: "A" })).rejects.toMatchObject({ code: "functions/invalid-argument" });
    await expect(p.call("completeProfile")({ name: "x".repeat(41) })).rejects.toMatchObject({ code: "functions/invalid-argument" });
  });

  it("rejects signed-out callers", async () => {
    const p = await newPlayer({ profile: false });
    await signOut(p.auth);
    await expect(p.call("completeProfile")({ name: "Nobody" })).rejects.toMatchObject({ code: "functions/unauthenticated" });
  });
});
