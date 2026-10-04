// Emulator only: start an Owl Raid right now on a poster (the /admin screen arrives on Day 7).
//   npx tsx scripts/raid.ts <posterIndex 0-9> [minPlayers=20] [minutes=15]
// Uses a fixed default raid challenge (meaning: "celebrate" → answer "to mark a happy event", index 0).
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { COL, raidChallengeId, type ChallengeDoc, type RaidDoc } from "../shared/types";
import { LINGOS, lingoId } from "./lingos";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
initializeApp({ projectId: "demo-decade-hunt" });

const [posterArg, minArg, minutesArg] = process.argv.slice(2);
const posterIndex = Number(posterArg ?? 2);
if (!Number.isInteger(posterIndex) || posterIndex < 0 || posterIndex >= LINGOS.length) {
  throw new Error("posterIndex must be 0-9");
}
const minPlayers = Number(minArg ?? 20);
const minutes = Number(minutesArg ?? 15);
const now = Date.now();
const raid: Omit<RaidDoc, "startAt" | "endAt"> & { startAt: Timestamp; endAt: Timestamp } = {
  posterIndex,
  lingoId: lingoId(LINGOS[posterIndex][1]),
  startAt: Timestamp.fromMillis(now),
  endAt: Timestamp.fromMillis(now + minutes * 60_000),
  minPlayers,
  unlocked: false,
  status: "active",
};
const challenge: ChallengeDoc = {
  type: "meaning",
  word: "celebrate",
  options: ["to mark a happy event", "to forget something", "to arrive late", "to complain loudly"],
  correctIndex: 0,
};
const db = getFirestore();
const ref = db.collection(COL.raids).doc();
const batch = db.batch();
batch.create(db.collection(COL.challenges).doc(raidChallengeId(ref.id)), challenge);
batch.create(ref, raid);
await batch.commit();
console.log(`Raid ${ref.id}: poster ${posterIndex + 1} (${raid.lingoId}), ${minutes} min, unlocks at ${minPlayers} players.`);
