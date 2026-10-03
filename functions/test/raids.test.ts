// Owl Raids against the emulators (PLAN 6.1): adminCreateRaid + joinRaid, 20 joins → unlocked.
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import type { AdminCreateRaidInput, AdminCreateRaidOutput, JoinRaidInput, JoinRaidOutput } from "../src/shared/types";
import { adb, adminAuth, CAMPUS, cleanupApps, newPlayer } from "./helpers";

afterAll(cleanupApps);

type Player = Awaited<ReturnType<typeof newPlayer>>;
const join = (p: Player, raidId: string) => p.call<JoinRaidInput, JoinRaidOutput>("joinRaid")({ raidId, ...CAMPUS });

async function admin() {
  const a = await newPlayer({ profile: false });
  await adminAuth.setCustomUserClaims(a.uid, { role: "admin" });
  await a.auth.currentUser!.getIdToken(true);
  return a;
}
const create = (a: Player, input: Partial<AdminCreateRaidInput>) =>
  a.call<Partial<AdminCreateRaidInput>, AdminCreateRaidOutput>("adminCreateRaid")(input);

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

    await expect(join(players[0], raidId)).resolves.toEqual({ joined: 19, unlocked: false }); // repeat join: no double count
    await expect(join(players[19], raidId)).resolves.toEqual({ joined: 20, unlocked: true });
    expect((await adb.doc(`raids/${raidId}`).get()).data()).toMatchObject({ joined: 20, unlocked: true });
    expect((await adb.collection(`raids/${raidId}/players`).get()).size).toBe(20);
    // A late joiner after unlock still counts.
    await expect(join(await newPlayer(), raidId)).resolves.toEqual({ joined: 21, unlocked: true });
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
});
