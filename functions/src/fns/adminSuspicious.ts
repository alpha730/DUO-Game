import { onCall } from "firebase-functions/v2/https";
import { COL, type AdminPlayersOutput, type UserDoc } from "../shared/types";
import { playerRow } from "../lib/adminPlayers";
import { db } from "../lib/db";
import { requireRole } from "../lib/guards";

const LIMIT = 200;

/**
 * Admin "Suspicious players" (Day 8): users with fast-answer flags, or "too good to be true"
 * (≥ 10 wins, ≥ 95 % accuracy, avg < 3 s — kept current as users.suspect by submitAttempt).
 * Two small indexed queries, only when the admin clicks; never reads all users (cost rules).
 */
export const adminSuspicious = onCall<unknown, Promise<AdminPlayersOutput>>(async (req) => {
  requireRole(req, ["admin"]);
  const users = db().collection(COL.users);
  const [flagged, suspect] = await Promise.all([
    users.where("flags", ">", 0).orderBy("flags", "desc").limit(LIMIT).get(),
    users.where("suspect", "==", true).limit(LIMIT).get(),
  ]);
  const byUid = new Map(
    [...flagged.docs, ...suspect.docs].map((d) => [d.id, playerRow(d.id, d.data() as UserDoc)] as const),
  );
  const rows = [...byUid.values()].sort((a, b) => b.flags - a.flags || b.accuracy - a.accuracy || a.avgAnswerMs - b.avgAnswerMs);
  return { rows };
});
