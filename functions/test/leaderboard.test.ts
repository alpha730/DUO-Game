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

async function plant(id: string, d: { points: number; wins: number; losses: number; totalAnswerMs: number; reachedAt: number }) {
  planted.push(id);
  await adb.doc(`users/${id}`).set({
    name: id,
    email: `${id}@x.test`,
    points: d.points,
    wins: d.wins,
    losses: d.losses,
    totalAnswerMs: d.totalAnswerMs,
    pointsReachedAt: Timestamp.fromMillis(d.reachedAt),
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
    expect(board.top[1]).toEqual({ uid: `${tag}-b-early`, name: `${tag}-b-early`, points: P, accuracy: 1, avgAnswerMs: 3000 });
    expect(board.top.length).toBeLessThanOrEqual(100);
    expect(Date.now() - board.updatedAt.toMillis()).toBeLessThan(60_000);
  });

  it("refresh now is admin-only", async () => {
    const p = await newPlayer();
    await expect(p.call("adminRefreshLeaderboard")({})).rejects.toMatchObject({ code: "functions/permission-denied" });
  });
});
