// Seeds lingos, config/game, today's challenges and prizes.
//   Emulator (default):  npx tsx scripts/seed.ts
//   Real launch dates:   npx tsx scripts/seed.ts --real-dates
//   Production:          GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/seed.ts --prod --project <id> --real-dates --campus <lat>,<lng>,<radiusM>
//                        then: npx tsx scripts/loadChallenges.ts --prod --project <id>
// --real-dates writes no sample challenges (the real ones come from scripts/loadChallenges.ts, and a
// re-seed must never overwrite them).
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  COL,
  DEFAULT_RULES,
  DOC,
  challengeId,
  type ChallengeDoc,
  type GameConfigDoc,
  type LingoDoc,
  type PrizeDoc,
} from "../shared/types";
import { LINGOS, lingoId } from "./lingos";

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const realDates = args.includes("--real-dates");
const projectArg = args.indexOf("--project");
const projectId = projectArg >= 0 ? args[projectArg + 1] : "demo-decade-hunt";
const campusArg = args.indexOf("--campus");
const campus = campusArg >= 0 ? args[campusArg + 1].split(",").map(Number) : null;
if (campus && (campus.length !== 3 || campus.some((n) => !Number.isFinite(n)) || campus[2] < 50)) {
  throw new Error("--campus needs <lat>,<lng>,<radiusM>, e.g. --campus 26.7838,75.8225,600");
}
if (prod && !campus) throw new Error("--prod needs the real campus: --campus <lat>,<lng>,<radiusM>");

if (!prod) process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
if (prod && projectId.startsWith("demo-")) throw new Error("--prod needs --project <real project id>");

initializeApp({ projectId });
const db = getFirestore();

const IST = "+05:30";
const istDate = (ms = Date.now()) => new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const today = istDate();

async function main() {
  const batch = db.batch();

  LINGOS.forEach(([name, year, rarity, color], posterIndex) => {
    const lingo: LingoDoc = {
      name,
      detYear: Number(year),
      posterIndex,
      modelUrl: `/assets/models/${lingoId(year)}.glb`, // placeholder cubes from make-placeholder-models.ts
      rarity,
      color,
    };
    batch.set(db.collection(COL.lingos).doc(lingoId(year)), lingo);
  });

  // DECISION: the emulator seed opens the game from today 00:00 IST and uses a huge campus radius
  // so everything is testable off-campus right now. --real-dates uses launch dates (SPEC/CLAUDE.md).
  const startAt = realDates ? `2026-10-10T00:00:00${IST}` : `${today}T00:00:00${IST}`;
  const lockAt = `2026-10-22T12:00:00${IST}`;
  const config: GameConfigDoc = {
    startAt: Timestamp.fromDate(new Date(startAt)),
    lockAt: Timestamp.fromDate(new Date(lockAt)),
    locked: false,
    // Emulator default: around JECRC, Sitapura, Jaipur with a huge radius (playable from anywhere).
    campusLat: campus?.[0] ?? 26.7838,
    campusLng: campus?.[1] ?? 75.8225,
    campusRadiusM: campus?.[2] ?? 20_000_000,
    rules: DEFAULT_RULES, // exactly SPEC §2 (see shared/types.ts)
  };
  batch.set(db.collection(COL.config).doc(DOC.gameConfig), config);

  // One sample of each type for today (medium, CEFR B1–B2 — SPEC §9).
  const challenges: Array<[string, ChallengeDoc]> = [
    [lingoId("2016"), { type: "pronounce", word: "programme", accept: ["program"] }],
    [lingoId("2017"), { type: "speak", phrase: "Practice every day and you will see the difference." }],
    [
      lingoId("2018"),
      {
        type: "meaning",
        word: "reluctant",
        options: ["unwilling", "excited", "tired", "careful"],
        correctIndex: 0,
      },
    ],
    [
      lingoId("2019"),
      {
        type: "question",
        prompt: "She has been working here ___ 2022.",
        options: ["since", "for", "from", "at"],
        correctIndex: 0,
      },
    ],
  ];
  // DECISION: every Lingo gets a challenge for the next 7 days (the 4 samples rotate), so the full
  // flow can be played on the emulators from any poster, on any day. Today, Lingos 2016–2019 keep
  // exactly the samples above (the tests rely on that).
  const samples = challenges.map(([, ch]) => ch);
  let written = 0;
  for (let day = 0; day < (realDates ? 0 : 7); day++) {
    const date = istDate(Date.now() + day * 86_400_000);
    LINGOS.forEach(([, year], i) => {
      batch.set(db.collection(COL.challenges).doc(challengeId(date, lingoId(year))), samples[(i + day) % samples.length]);
      written++;
    });
  }

  const prizes: Array<[string, PrizeDoc]> = [
    ["sticker-pack", { name: "Sticker pack", cost: 200, stock: 200 }],
    ["tshirt", { name: "T-shirt", cost: 1000, stock: 30 }],
  ];
  for (const [id, prize] of prizes) batch.set(db.collection(COL.prizes).doc(id), prize);

  await batch.commit();
  console.log(
    `Seeded ${prod ? "PROD" : "emulator"} (${projectId}): ${LINGOS.length} lingos, config/game ` +
      `(start ${startAt}, lock ${lockAt}), ${written} sample challenges${realDates ? " (real ones: scripts/loadChallenges.ts)" : ` (10 Lingos × 7 days from ${today})`}, ${prizes.length} prizes.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
