import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, type AdminStatsOutput } from "../shared/types";
import { missingChallenges } from "../lib/admin";
import { istDate } from "../lib/date";
import { db, loadConfig } from "../lib/db";
import { requireRole } from "../lib/guards";

/**
 * Admin stats (PLAN 7.2): users, attempts today, wins today, and which game days × Lingos still
 * lack a challenge.
 *
 * DECISION (cost rules): totals use count() aggregations — they read no user documents (billed
 * 1 read per 1000 index entries, ~20 reads for 20k users). Only on the admin's click, never live.
 */
export const adminStats = onCall<unknown, Promise<AdminStatsOutput>>(async (req) => {
  requireRole(req, ["admin"]);
  const config = await loadConfig();
  if (!config) throw new HttpsError("failed-precondition", "Game is not configured — run the seed first.");
  const today = istDate();
  const attempts = db().collection(COL.attempts).where("date", "==", today);
  const [users, attemptsToday, winsToday, lingos, challenges] = await Promise.all([
    db().collection(COL.users).count().get(),
    attempts.count().get(),
    attempts.where("status", "==", "won").count().get(),
    db().collection(COL.lingos).select().get(),
    db().collection(COL.challenges).select().get(),
  ]);
  const missing = missingChallenges(
    { startAt: config.startAt.toMillis(), lockAt: config.lockAt.toMillis() },
    lingos.docs.map((d) => d.id).sort(),
    new Set(challenges.docs.map((d) => d.id)),
  );
  return {
    today,
    users: users.data().count,
    attemptsToday: attemptsToday.data().count,
    winsToday: winsToday.data().count,
    missingChallenges: missing.slice(0, 20),
    missingCount: missing.length,
  };
});
