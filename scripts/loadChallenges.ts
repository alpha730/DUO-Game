// Loads the real challenges (PLAN 7.3) after validating them with the same rules as the /admin upload
// (4 different options, correctIndex 0–3, dates inside the game, known Lingos, no duplicates), then
// checks that every game day × Lingo (Oct 10–22) has one.
//   Emulator (default):  npx tsx scripts/loadChallenges.ts [file=scripts/content/challenges-2026.json]
//   Production:          GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/loadChallenges.ts --prod --project <id>
// Needs functions/src/shared (run `npm run prebuild` in /functions once on a fresh clone).
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { missingChallenges, parseChallengeUpload } from "../functions/src/lib/admin";
import { COL, DOC, type GameConfigDoc } from "../shared/types";

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const projectArg = args.indexOf("--project");
const projectId = projectArg >= 0 ? args[projectArg + 1] : "demo-decade-hunt";
const file = args.find((a, i) => !a.startsWith("--") && !(projectArg >= 0 && i === projectArg + 1)) ?? "scripts/content/challenges-2026.json";
if (!prod) process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
if (prod && projectId.startsWith("demo-")) throw new Error("--prod needs --project <real project id>");

initializeApp({ projectId });
const db = getFirestore();

const GAME = { startAt: Date.parse("2026-10-10T00:00:00+05:30"), lockAt: Date.parse("2026-10-22T12:00:00+05:30") };

const config = (await db.collection(COL.config).doc(DOC.gameConfig).get()).data() as GameConfigDoc | undefined;
if (!config) throw new Error("No config/game — run scripts/seed.ts first.");
const lingoIds = (await db.collection(COL.lingos).select().get()).docs.map((d) => d.id).sort();
const rows = JSON.parse(readFileSync(file, "utf8"));
const parsed = parseChallengeUpload(rows, { startAt: config.startAt.toMillis(), lockAt: config.lockAt.toMillis() }, new Set(lingoIds));
if ("errors" in parsed) {
  for (const e of parsed.errors) console.error(`Row ${e.row}: ${e.message}`);
  throw new Error(`${parsed.errors.length} bad row(s) — nothing written.`);
}
const missing = missingChallenges(GAME, lingoIds, new Set(parsed.docs.map((d) => d.id)));
if (missing.length) throw new Error(`File misses ${missing.length} game day × Lingo slots, e.g. ${missing.slice(0, 5).join(", ")}`);

for (let i = 0; i < parsed.docs.length; i += 500) {
  const batch = db.batch();
  for (const { id, doc } of parsed.docs.slice(i, i + 500)) batch.set(db.collection(COL.challenges).doc(id), doc);
  await batch.commit();
}
const types = parsed.docs.reduce<Record<string, number>>((m, d) => ((m[d.doc.type] = (m[d.doc.type] ?? 0) + 1), m), {});
console.log(`Wrote ${parsed.docs.length} challenges to ${prod ? projectId : "the emulator"} (${JSON.stringify(types)}); every day Oct 10–22 × ${lingoIds.length} Lingos covered.`);
