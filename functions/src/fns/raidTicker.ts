import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { COL, type RaidDoc } from "../shared/types";
import { db } from "../lib/db";
import { raidPhase } from "../lib/raids";
import { SCHEDULE_INSTANCES } from "../lib/instances";

/**
 * Keeps raids/{id}.status in step with the clock (scheduled → active → ended) so the Home banner can
 * listen to "status in [scheduled, active]". Reads only unfinished raids (a handful). The functions
 * themselves always decide by time (raidPhase), so a late tick never lets anyone in early or late.
 */
export const raidTicker = onSchedule({ ...SCHEDULE_INSTANCES, schedule: "every 1 minutes", timeZone: "Asia/Kolkata" }, async () => {
  const now = Date.now();
  const open = await db().collection(COL.raids).where("status", "in", ["scheduled", "active"]).get();
  const batch = db().batch();
  let changed = 0;
  for (const d of open.docs) {
    const phase = raidPhase(d.data() as RaidDoc, now);
    if (phase !== d.data().status) {
      batch.update(d.ref, { status: phase });
      changed++;
    }
  }
  if (changed) await batch.commit();
  logger.info("raid statuses", { open: open.size, changed });
});
