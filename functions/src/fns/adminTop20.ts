import { onCall } from "firebase-functions/v2/https";
import { COL, DOC, type AdminPlayersOutput, type StudentsBoardDoc, type UserDoc } from "../shared/types";
import { playerRow } from "../lib/adminPlayers";
import { db, userRef } from "../lib/db";
import { requireRole } from "../lib/guards";
import { refreshStudentsBoard } from "../lib/leaderboard";
import { isQualified } from "../lib/rank";

const TOP = 20;

/**
 * Admin top-20 export for the final (SPEC §10, PLAN Oct 22): re-ranks now (same top-300 query as
 * the 10-minute refresh), then returns the first 20 — qualified players (both favourites at MAX)
 * first, each group in leaderboard order — with email + cheat flags.
 */
export const adminTop20 = onCall<unknown, Promise<AdminPlayersOutput>>(async (req) => {
  requireRole(req, ["admin"]);
  await refreshStudentsBoard();
  const board = (await db().collection(COL.leaderboard).doc(DOC.studentsBoard).get()).data() as StudentsBoardDoc | undefined;
  // One-day event rule: only players with BOTH favourites at MAX can win, so they come first (in
  // leaderboard order), then everyone else (also in leaderboard order).
  const all = board?.top ?? [];
  const top = [...all.filter((r) => isQualified(r.favMax)), ...all.filter((r) => !isQualified(r.favMax))].slice(0, TOP);
  const snaps = top.length ? await db().getAll(...top.map((r) => userRef(r.uid))) : [];
  return {
    rows: snaps.filter((s) => s.exists).map((s) => playerRow(s.id, s.data() as UserDoc, top.findIndex((r) => r.uid === s.id) + 1)),
    updatedAt: board?.updatedAt.toMillis(),
  };
});
