// refreshLeaderboard via the admin "refresh now" callable (PLAN 5.1).
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import type { StudentsBoardDoc } from "../src/shared/types";
import { adb, adminAuth, cleanupApps, newPlayer } from "./helpers";

const planted: string[] = [];
afterAll(async () => {
  await Promise.all(planted.map((id) => adb.doc(`users/${id}`).delete()));
  await cleanupApps();
});

async function plant(id: string, d: { points: number; wins: number; losses: number; totalAnswerMs: number; reachedAt: number; favMaxCount?: number }) {
  planted.push(id);
  await adb.doc(`users/${id}`).set({
    name: id,
    email: `${id}@x.test`,
    points: d.points,
    wins: d.wins,
    losses: d.losses,
    totalAnswerMs: d.totalAnswerMs,
    pointsReachedAt: Timestamp.fromMillis(d.reachedAt),
    ...(d.favMaxCount !== undefined ? { favMaxCount: d.favMaxCount } : {}),
    profileDone: true,
  });
}

describe("leaderboard refresh", () => {
  it("ranks equal points by accuracy, then speed, then who reached it first", async () => {
    const tag = `lb${Date.now().toString(36)}`;
    const P = 9_000_000; // far above any other test user
    await plant(`${tag}-d-late`, { points: P, wins: 4, losses: 0, totalAnswerMs: 12_000, reachedAt: 5_000 });
    await plant(`${tag}-c-slow`, { points: P, wins: 4, losses: 0, totalAnswerMs: 40_000, reachedAt: 1_000 });
    await plant(`${tag}-b-early`, { points: P, wins: 4, losses: 0, totalAnswerMs: 12_000, reachedAt: 1_000 });
    await plant(`${tag}-e-sloppy`, { points: P, wins: 4, losses: 4, totalAnswerMs: 4_000, reachedAt: 1_000 });
    await plant(`${tag}-a-top`, { points: P + 1, wins: 1, losses: 9, totalAnswerMs: 90_000, reachedAt: 9_000 });

    const admin = await newPlayer({ profile: false });
    await adminAuth.setCustomUserClaims(admin.uid, { role: "admin" });
    await admin.auth.currentUser!.getIdToken(true);
    const out = await admin.call<object, { rows: number }>("adminRefreshLeaderboard")({});
    expect(out.rows).toBeGreaterThanOrEqual(5);

    const board = (await adb.doc("leaderboard/students").get()).data() as StudentsBoardDoc;
    expect(board.top.slice(0, 5).map((r) => r.uid)).toEqual([
      `${tag}-a-top`, // most points
      `${tag}-b-early`, // 100 %, 3 s avg, reached first
      `${tag}-d-late`, // 100 %, 3 s avg, reached later
      `${tag}-c-slow`, // 100 %, 10 s avg
      `${tag}-e-sloppy`, // 50 %
    ]);
    expect(board.top[1]).toEqual({ uid: `${tag}-b-early`, name: `${tag}-b-early`, points: P, accuracy: 1, avgAnswerMs: 3000, favMax: 0 });
    expect(board.top.length).toBeLessThanOrEqual(100);
    expect(Date.now() - board.updatedAt.toMillis()).toBeLessThan(60_000);
  });

  it("one-day event: favourites at MAX rank right after points (before accuracy and speed)", async () => {
    const tag = `fm${Date.now().toString(36)}`;
    const P = 9_500_000; // above the test above
    await plant(`${tag}-a-fast`, { points: P, wins: 4, losses: 0, totalAnswerMs: 4_000, reachedAt: 1_000, favMaxCount: 1 });
    await plant(`${tag}-b-qualified`, { points: P, wins: 4, losses: 4, totalAnswerMs: 40_000, reachedAt: 9_000, favMaxCount: 2 });
    await plant(`${tag}-c-none`, { points: P, wins: 4, losses: 0, totalAnswerMs: 4_000, reachedAt: 500 });
    const admin = await newPlayer({ profile: false });
    await adminAuth.setCustomUserClaims(admin.uid, { role: "admin" });
    await admin.auth.currentUser!.getIdToken(true);
    await admin.call<object, { rows: number }>("adminRefreshLeaderboard")({});
    const board = (await adb.doc("leaderboard/students").get()).data() as StudentsBoardDoc;
    expect(board.top.slice(0, 3).map((r) => [r.uid, r.favMax])).toEqual([
      [`${tag}-b-qualified`, 2], // both favourites at MAX beats better accuracy and speed
      [`${tag}-a-fast`, 1],
      [`${tag}-c-none`, 0], // the best accuracy, speed and earliest, but no favourite at MAX
    ]);
  });

  // Production: admins only (requireRole, unit-tested in guards.test.ts). The emulator lets any
  // signed-in player refresh because it never runs the schedule.
  it("refresh now needs sign-in (any player on the emulator)", async () => {
    const p = await newPlayer();
    await expect(p.call<object, { rows: number }>("adminRefreshLeaderboard")({})).resolves.toMatchObject({ rows: expect.any(Number) });
  });
});
