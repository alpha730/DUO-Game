import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, type AdminUpsertQuestionsInput, type AdminUpsertQuestionsOutput } from "../shared/types";
import { db } from "../lib/db";
import { requireRole } from "../lib/guards";
import { dropPoolCache } from "../lib/questionPool";
import { MAX_POOL_WRITES, countQuestions, parseQuestionPool } from "../lib/questions";

/**
 * Admin: upload the question pool (SPEC §9). Every row is validated first (unique ids, level/type,
 * 4 different options, correctIndex 0–3); any error → nothing is written and the bad rows come back.
 * The upload replaces the pool: ids not in it are removed. One batch = all-or-nothing.
 */
export const adminUpsertQuestions = onCall<AdminUpsertQuestionsInput, Promise<AdminUpsertQuestionsOutput>>(async (req) => {
  requireRole(req, ["admin"]);
  const parsed = parseQuestionPool(req.data?.questions);
  if ("errors" in parsed) {
    throw new HttpsError("invalid-argument", `${parsed.errors.length} row(s) have problems — nothing was saved.`, {
      code: "bad-rows",
      errors: parsed.errors.slice(0, 50),
    });
  }
  const col = db().collection(COL.questions);
  const keep = new Set(parsed.questions.map((q) => q.id));
  const stale = (await col.select().get()).docs.filter((d) => !keep.has(d.id));
  if (parsed.questions.length + stale.length > MAX_POOL_WRITES) {
    throw new HttpsError("invalid-argument", "Too many changes for one upload — remove old questions in smaller steps.", { code: "too-big" });
  }
  const batch = db().batch();
  for (const q of parsed.questions) batch.set(col.doc(q.id), q.doc);
  for (const d of stale) batch.delete(d.ref);
  await batch.commit();
  dropPoolCache(); // this instance uses the new pool at once; others within 10 minutes
  return { written: parsed.questions.length, removed: stale.length, counts: countQuestions(parsed.questions) };
});
