// Loads the question pool (SPEC §9) after validating it with the same rules as the /admin upload:
// unique ids, level medium|hard, type meaning|question|pronounce, 4 different options, correctIndex 0–3.
// All-or-nothing (one batch); the upload replaces the pool (ids not in the file are removed).
//   Emulator (default):  npx tsx scripts/loadQuestions.ts [file=scripts/content/question-pool-2026.json]
//   Production:          GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/loadQuestions.ts --prod --project <id>
// Needs functions/src/shared (run `npm run prebuild` in /functions once on a fresh clone).
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { writeQuestionPool } from "./questionPool";

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const projectArg = args.indexOf("--project");
const projectId = projectArg >= 0 ? args[projectArg + 1] : "demo-decade-hunt";
const file = args.find((a, i) => !a.startsWith("--") && !(projectArg >= 0 && i === projectArg + 1)) ?? "scripts/content/question-pool-2026.json";
if (!prod) process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
if (prod && projectId.startsWith("demo-")) throw new Error("--prod needs --project <real project id>");

initializeApp({ projectId });
const out = await writeQuestionPool(getFirestore(), file);
console.log(
  `Wrote ${out.written} questions to ${prod ? projectId : "the emulator"} (removed ${out.removed} old):\n` +
    Object.entries(out.counts)
      .map(([k, n]) => `  ${k.padEnd(18)} ${n}`)
      .join("\n"),
);
