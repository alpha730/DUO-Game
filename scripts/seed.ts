// Seeds lingos, config/game, today's challenges and prizes.
//   Emulator (default):  npx tsx scripts/seed.ts
//   Real launch dates:   npx tsx scripts/seed.ts --real-dates
//   Production:          GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/seed.ts --prod --project <id> --real-dates
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
    // Placeholder: JECRC, Sitapura, Jaipur — set the real centre on Day 7 (task 7.4).
    campusLat: 26.7838,
    campusLng: 75.8225,
    campusRadiusM: prod ? 600 : 20_000_000,
    rules: DEFAULT_RULES, // exactly SPEC §2 (see shared/types.ts)
  };
  batch.set(db.collection(COL.config).doc(DOC.gameConfig), config);

  const challenges: Array<[string, ChallengeDoc]> = [
    [lingoId("2016"), { type: "speak", phrase: "Ten years of opening doors to the world" }],
    [
      lingoId("2017"),
      {
        type: "meaning",
        word: "resilient",
        options: ["Easily broken", "Able to recover quickly", "Very quiet", "Always late"],
        correctIndex: 1,
      },
    ],
  ];
  for (const [id, ch] of challenges) {
    batch.set(db.collection(COL.challenges).doc(challengeId(today, id)), ch);
  }

  const prizes: Array<[string, PrizeDoc]> = [
    ["sticker-pack", { name: "Sticker pack", cost: 200, stock: 200 }],
    ["tshirt", { name: "T-shirt", cost: 1000, stock: 30 }],
  ];
  for (const [id, prize] of prizes) batch.set(db.collection(COL.prizes).doc(id), prize);

  await batch.commit();
  console.log(
    `Seeded ${prod ? "PROD" : "emulator"} (${projectId}): ${LINGOS.length} lingos, config/game ` +
      `(start ${startAt}, lock ${lockAt}), ${challenges.length} challenges for ${today}, ${prizes.length} prizes.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
