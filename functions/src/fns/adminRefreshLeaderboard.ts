import { onCall } from "firebase-functions/v2/https";
import { isEmulator } from "../lib/geo";
import { requireAuth, requireRole } from "../lib/guards";
import { refreshStudentsBoard } from "../lib/leaderboard";

/** Admin "refresh now" (PLAN 5.1) — same work as the 10-minute schedule. */
export const adminRefreshLeaderboard = onCall<unknown, Promise<{ rows: number }>>(async (req) => {
  // DECISION: the emulator never runs the schedule, so for laptop play any signed-in player may
  // refresh there. Production: admins only.
  if (isEmulator()) requireAuth(req);
  else requireRole(req, ["admin"]);
  return { rows: await refreshStudentsBoard() };
});
