import { onCall } from "firebase-functions/v2/https";
import { refreshStudentsBoard } from "../lib/leaderboard";
import { requireRole } from "../lib/guards";

/** Admin "refresh now" (PLAN 5.1) — same work as the 10-minute schedule. */
export const adminRefreshLeaderboard = onCall<unknown, Promise<{ rows: number }>>(async (req) => {
  requireRole(req, ["admin"]);
  return { rows: await refreshStudentsBoard() };
});
