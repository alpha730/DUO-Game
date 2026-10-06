// Shared by scripts/loadQuestions.ts and scripts/seed.ts: validate the pool file, then replace
// questions/* in one batch (all-or-nothing).
import { readFileSync } from "node:fs";
import type { Firestore } from "firebase-admin/firestore";
import { MAX_POOL_WRITES, countQuestions, parseQuestionPool } from "../functions/src/lib/questions";
import { COL, type QuestionCounts } from "../shared/types";

export const POOL_FILE = "scripts/content/question-pool-2026.json";

export async function writeQuestionPool(
  db: Firestore,
  file = POOL_FILE,
): Promise<{ written: number; removed: number; counts: QuestionCounts }> {
  const parsed = parseQuestionPool(JSON.parse(readFileSync(file, "utf8")));
  if ("errors" in parsed) {
    for (const e of parsed.errors) console.error(`Row ${e.row}: ${e.message}`);
    throw new Error(`${parsed.errors.length} bad row(s) — nothing written.`);
  }
  const col = db.collection(COL.questions);
  const keep = new Set(parsed.questions.map((q) => q.id));
  const stale = (await col.select().get()).docs.filter((d) => !keep.has(d.id));
  if (parsed.questions.length + stale.length + 1 > MAX_POOL_WRITES) throw new Error("Too many writes for one batch.");
  const batch = db.batch();
  for (const q of parsed.questions) batch.set(col.doc(q.id), q.doc);
  for (const d of stale) batch.delete(d.ref);
  // Emulator: functions drop their cached pool at once (production refreshes within 10 minutes).
  if (process.env.FIRESTORE_EMULATOR_HOST) batch.set(db.doc("_emulator/questions"), { version: String(Date.now()) });
  await batch.commit();
  return { written: parsed.questions.length, removed: stale.length, counts: countQuestions(parsed.questions) };
}
