// SPEC §2 (rule change): each player can TRY 4 DIFFERENT Lingos per IST day, ONE try per Lingo.
// Won, failed and forfeit all close that Lingo for the day and use 1 of the 4. Raids stay outside.
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { AdminCreateRaidOutput, GetMyStateOutput, StartAttemptOutput, SubmitAttemptOutput } from "../src/shared/types";
import { adb, adminAuth, CAMPUS, cleanupApps, FUNCTIONS_ORIGIN, istToday, newPlayer } from "./helpers";

afterEach(() => adb.doc("_emulator/clock").delete());
afterAll(cleanupApps);

type Player = Awaited<ReturnType<typeof newPlayer>>;
const L = (n: number) => `lingo-${2015 + n}`; // "Lingo n" = poster n (1-based)
const start = (p: Player, lingoId: string, extra: object = {}) =>
  p.call<object, StartAttemptOutput>("startAttempt")({ lingoId, ...CAMPUS, ...extra });
/** Wrong whatever the type: a choice that isn't the seeded answer and a transcript that matches nothing. */
const failTry = async (p: Player, lingoId: string) =>
  p.call<object, SubmitAttemptOutput>("submitAttempt")({ attemptId: (await start(p, lingoId)).attemptId, choice: 3, transcript: "zzz" });
const state = (p: Player) => p.call<object, GetMyStateOutput>("getMyState")({});

describe("one try per Lingo per day, 4 different Lingos", () => {
  it("fail Lingo 2 → retrying Lingo 2 today is refused (no try used)", async () => {
    const p = await newPlayer();
    expect(await failTry(p, L(2))).toMatchObject({ result: "failed" });
    const err = await start(p, L(2)).catch((e) => e);
    expect(err.details.code).toBe("already-tried");
    expect(err.message).toMatch(/^You've already tried .+ today — come back tomorrow/);
    const s = await state(p);
    expect(s.attemptsLeft).toBe(3);
    expect(s.user!.triedToday).toEqual([L(2)]);
  });

  it("fail 2, then 1, 5 and 7 are all allowed; a 5th different Lingo is refused", async () => {
    const p = await newPlayer();
    await failTry(p, L(2));
    for (const n of [1, 5, 7]) await expect(start(p, L(n))).resolves.toHaveProperty("attemptId");
    const err = await start(p, L(9)).catch((e) => e);
    expect(err.details.code).toBe("no-attempts");
    expect(err.message).toMatch(/^You've tried 4 Lingos today — come back tomorrow/);
    expect((await state(p)).user!.triedToday).toEqual([L(2), L(1), L(5), L(7)]);
  });

  it("a forfeit closes the Lingo too (left open, or forfeited by the one-chance rule)", async () => {
    const p = await newPlayer();
    const a = await start(p, L(3));
    const res = await fetch(`${FUNCTIONS_ORIGIN}/forfeitAttempt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await p.idToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: a.attemptId }),
    });
    expect(res.status).toBe(204);
    await expect(start(p, L(3))).rejects.toMatchObject({ details: { code: "already-tried" } });
    // Started then abandoned (auto-forfeited when the app reopens) also counts.
    await start(p, L(4));
    await state(p); // auto-forfeit
    await expect(start(p, L(4))).rejects.toMatchObject({ details: { code: "already-tried" } });
  });

  it("refusals before Start don't use a Lingo (needs-speech)", async () => {
    const p = await newPlayer();
    await expect(start(p, L(2), { speech: false })).rejects.toMatchObject({ details: { code: "needs-speech" } }); // speak today
    expect((await state(p)).user!.triedToday ?? []).toEqual([]);
    await expect(start(p, L(2))).resolves.toHaveProperty("attemptId");
  });

  it("the next IST day Lingo 2 is open again", async () => {
    const p = await newPlayer();
    await failTry(p, L(2));
    const tomorrow = Date.parse(`${istToday()}T00:00:00+05:30`) + 86_400_000;
    await adb.doc("_emulator/clock").set({ offsetMs: tomorrow + 60_000 - Date.now() });
    const s = await state(p);
    expect(s.user!.triedToday).toEqual([]);
    expect(s.attemptsLeft).toBe(4);
    await expect(start(p, L(2))).resolves.toHaveProperty("attemptId");
  });

  it("a raid on Lingo 2 is still allowed after failing Lingo 2 normally (and doesn't use one of the 4)", async () => {
    const p = await newPlayer();
    await failTry(p, L(2));
    const admin = await newPlayer();
    await adminAuth.setCustomUserClaims(admin.uid, { role: "admin" });
    await admin.auth.currentUser!.getIdToken(true);
    const { raidId } = await admin.call<object, AdminCreateRaidOutput>("adminCreateRaid")({
      posterIndex: 1,
      lingoId: L(2),
      startAt: Date.now(),
      minPlayers: 1,
      challenge: { type: "meaning", word: "keen", options: ["eager", "sad", "slow", "late"], correctIndex: 0 },
    });
    await p.call("joinRaid")({ raidId, ...CAMPUS });
    const r = await start(p, L(2), { raidId });
    expect(r.attemptsLeft).toBe(3);
    const won = await p.call<object, SubmitAttemptOutput>("submitAttempt")({ attemptId: r.attemptId, choice: 0 });
    expect(won).toMatchObject({ result: "won", raid: true });
    expect((await state(p)).user!.triedToday).toEqual([L(2)]); // the raid isn't listed
  });
});
