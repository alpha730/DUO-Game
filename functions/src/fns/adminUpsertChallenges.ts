import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, type AdminUpsertChallengesInput, type AdminUpsertChallengesOutput } from "../shared/types";
import { parseChallengeUpload } from "../lib/admin";
import { db, loadConfig } from "../lib/db";
import { requireRole } from "../lib/guards";

/**
 * Admin: upload challenges JSON (PLAN 7.2). All rows are validated first (4 different options,
 * correctIndex 0–3, date inside the game, known Lingo, no duplicates); any error → nothing is
 * written and the bad rows are returned. Existing challenges with the same date × Lingo are replaced.
 */
export const adminUpsertChallenges = onCall<AdminUpsertChallengesInput, Promise<AdminUpsertChallengesOutput>>(async (req) => {
  requireRole(req, ["admin"]);
  const config = await loadConfig();
  if (!config) throw new HttpsError("failed-precondition", "Game is not configured — run the seed first.");
  const lingos = await db().collection(COL.lingos).select().get();
  const parsed = parseChallengeUpload(
    req.data?.challenges,
    { startAt: config.startAt.toMillis(), lockAt: config.lockAt.toMillis() },
    new Set(lingos.docs.map((d) => d.id)),
  );
  if ("errors" in parsed) {
    throw new HttpsError("invalid-argument", `${parsed.errors.length} row(s) have problems — nothing was saved.`, {
      code: "bad-rows",
      errors: parsed.errors.slice(0, 50),
    });
  }
  // Batches of ≤ 500 writes (Firestore limit).
  for (let i = 0; i < parsed.docs.length; i += 500) {
    const batch = db().batch();
    for (const { id, doc } of parsed.docs.slice(i, i + 500)) batch.set(db().collection(COL.challenges).doc(id), doc);
    await batch.commit();
  }
  return { written: parsed.docs.length };
});
