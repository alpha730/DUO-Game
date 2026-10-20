import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, type AdminStatsOutput } from "../shared/types";
import { serverNow } from "../lib/clock";
import { questionPool } from "../lib/questionPool";
import { countQuestions } from "../lib/questions";
import { playPeriod } from "../lib/date";
import { db, loadConfig } from "../lib/db";
import { requireRole } from "../lib/guards";

/**
 * Admin stats (PLAN 7.2): users, attempts today, wins today, and the question pool per level × type
 * (counted from the in-memory pool — no extra reads).
 *
 * DECISION (cost rules): totals use count() aggregations — they read no user documents (billed
 * 1 read per 1000 index entries, ~20 reads for 20k users). Only on the admin's click, never live.
 */
export const adminStats = onCall<unknown, Promise<AdminStatsOutput>>(async (req) => {
  requireRole(req, ["admin"]);
  const config = await loadConfig();
  if (!config) throw new HttpsError("failed-precondition", "Game is not configured — run the seed first.");
  const today = playPeriod(await serverNow(), config).key; // the IST date, or the round (one-day event)
  const attempts = db().collection(COL.attempts).where("date", "==", today);
  const [users, attemptsToday, winsToday, pool] = await Promise.all([
    db().collection(COL.users).count().get(),
    attempts.count().get(),
    attempts.where("status", "==", "won").count().get(),
    questionPool(),
  ]);
  return {
    today,
    users: users.data().count,
    attemptsToday: attemptsToday.data().count,
    winsToday: winsToday.data().count,
    questions: countQuestions(pool),
    questionTotal: pool.length,
  };
});
