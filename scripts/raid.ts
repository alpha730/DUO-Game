// Emulator only: start an Owl Raid right now on a poster (the /admin screen arrives on Day 7).
//   npx tsx scripts/raid.ts <posterIndex 0-9> [minPlayers=20] [minutes=15]
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { COL, type RaidDoc } from "../shared/types";
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
  joined: 0,
  unlocked: false,
  status: "active",
};
const ref = await getFirestore().collection(COL.raids).add(raid);
console.log(`Raid ${ref.id}: poster ${posterIndex + 1} (${raid.lingoId}), ${minutes} min, unlocks at ${minPlayers} players.`);
