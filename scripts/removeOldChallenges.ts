// Deletes the OLD easy date × Lingo challenges (challenges/{date}_{lingoId}, from the archived
// challenges-2026.json) from Firestore. Since commit 8e7cccb the game asks only questions from the
// question pool (questions/*, scripts/loadQuestions.ts); these docs are never read any more, but a
// backend deployed before that commit still serves them. Owl Raid challenges (challenges/raid_*) are kept.
//   Emulator (default):  npx tsx scripts/removeOldChallenges.ts [--yes]
//   Production:          GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/removeOldChallenges.ts --prod --project <id> [--yes]
// Without --yes it only lists what it would delete.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const yes = args.includes("--yes");
const projectArg = args.indexOf("--project");
const projectId = projectArg >= 0 ? args[projectArg + 1] : "demo-decade-hunt";
if (!prod) process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
if (prod && projectId.startsWith("demo-")) throw new Error("--prod needs --project <real project id>");

initializeApp({ projectId });
const db = getFirestore();
const docs = (await db.collection("challenges").select().get()).docs.filter((d) => !d.id.startsWith("raid_"));
console.log(`${docs.length} old date × Lingo challenge(s) in ${prod ? projectId : "the emulator"}${docs.length ? `: ${docs.slice(0, 5).map((d) => d.id).join(", ")}${docs.length > 5 ? " …" : ""}` : ""}`);
if (!docs.length) process.exit(0);
if (!yes) {
  console.log("Nothing deleted. Run again with --yes to delete them (raid_* challenges are kept).");
  process.exit(0);
}
for (let i = 0; i < docs.length; i += 400) {
  const batch = db.batch();
  for (const d of docs.slice(i, i + 400)) batch.delete(d.ref);
  await batch.commit();
}
console.log(`Deleted ${docs.length}.`);
