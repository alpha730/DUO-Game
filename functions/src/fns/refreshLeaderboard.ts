import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { refreshStudentsBoard } from "../lib/leaderboard";
import { SCHEDULE_INSTANCES } from "../lib/instances";

/** Every 10 minutes (CLAUDE.md cost rules): top 300 by points → tie-break → top 100. */
export const refreshLeaderboard = onSchedule({ ...SCHEDULE_INSTANCES, schedule: "every 10 minutes", timeZone: "Asia/Kolkata" }, async () => {
  const rows = await refreshStudentsBoard();
  logger.info("leaderboard refreshed", { rows });
});
