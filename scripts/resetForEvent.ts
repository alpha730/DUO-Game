// Wipes every PLAYER's game data before the one-day event, so everyone starts from 0. Staff
// (accounts with a custom-claim role: admin / volunteer) and their roles are kept, with their data.
//   Emulator (default):  npx tsx scripts/resetForEvent.ts            (dry run: counts only)
//                        npx tsx scripts/resetForEvent.ts --yes      (does it)
//   Production:          GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/resetForEvent.ts --prod --project <id> [--yes]
//   Options:             --delete-users  also delete the players' Auth accounts and user docs
//                        --project <id>  on the emulator too (default demo-decade-hunt)
// For each non-staff player it deletes: catches, attempts, raid players (raids/*/players), redemptions,
// pointsLog, rate-limit docs (limits/{uid}); and resets the user doc's counters (points, spent, wins,
// losses, totalAnswerMs, favourites, streaks, favMaxCount, the per-round fields, seenQ,
// pointsReachedAt, flags and the other cheat signals). `disabled` (an admin's decision) is kept.
// Then it clears leaderboard/students and recounts the raids' joined shards. Counts are printed
// before anything is deleted; without --yes nothing is written.
import { initializeApp } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { COL, DEFAULT_RULES, DOC, RAID_SHARDS, type GameConfigDoc, type Role, type UserDoc } from "../shared/types";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const prod = args.includes("--prod");
const yes = args.includes("--yes");
const deleteUsers = args.includes("--delete-users");
const projectId = opt("project", "demo-decade-hunt");
if (prod && projectId.startsWith("demo-")) throw new Error("--prod needs --project <real project id>");
if (!prod) {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
}

initializeApp({ projectId });
const db = getFirestore();
const auth = getAuth();
const STAFF: Role[] = ["admin", "volunteer"];

// --- Who is staff (Auth custom claims), who is a player.
const accounts: UserRecord[] = [];
for (let page: string | undefined; ; ) {
  const res = await auth.listUsers(1000, page);
  accounts.push(...res.users);
  if (!(page = res.pageToken)) break;
}
const staff = new Map(accounts.filter((u) => STAFF.includes(u.customClaims?.role as Role)).map((u) => [u.uid, u.customClaims!.role as Role]));
const isPlayer = (uid: unknown) => typeof uid === "string" && !staff.has(uid);

// --- What would go (read only uid fields; whole collections, once — this is a one-off reset).
const byUid = async (col: string) => (await db.collection(col).select("uid").get()).docs.filter((d) => isPlayer(d.get("uid"))).map((d) => d.ref);
const userDocs = (await db.collection(COL.users).get()).docs.filter((d) => isPlayer(d.id));
const [attempts, redemptions, pointsLog] = await Promise.all([byUid(COL.attempts), byUid(COL.redemptions), byUid(COL.pointsLog)]);
const catches = (await db.collectionGroup(COL.catches).get()).docs.filter((d) => d.ref.parent.parent?.parent.id === COL.users && isPlayer(d.ref.parent.parent.id)).map((d) => d.ref);
const raidPlayers = (await db.collectionGroup(COL.players).get()).docs.filter((d) => d.ref.parent.parent?.parent.id === COL.raids && isPlayer(d.id)).map((d) => d.ref);
const limits = (await db.collection(COL.limits).get()).docs.filter((d) => isPlayer(d.id)).map((d) => d.ref);
const authPlayers = accounts.filter((u) => !staff.has(u.uid));
const board = db.collection(COL.leaderboard).doc(DOC.studentsBoard);
const boardRows = ((await board.get()).data()?.top as unknown[] | undefined)?.length ?? 0;

console.log(`${prod ? projectId : `Emulator (${projectId})`} — reset for the event${yes ? "" : " (DRY RUN — nothing is written; add --yes)"}`);
console.log(`  Staff kept: ${staff.size} (${[...staff.values()].filter((r) => r === "admin").length} admin, ${[...staff.values()].filter((r) => r === "volunteer").length} volunteer) — roles and data untouched`);
console.log(`  Players: ${userDocs.length} user docs, ${authPlayers.length} Auth accounts`);
console.log(`  Delete: ${catches.length} catches, ${attempts.length} attempts, ${raidPlayers.length} raid players, ${redemptions.length} redemptions, ${pointsLog.length} pointsLog, ${limits.length} rate-limit docs`);
console.log(
  deleteUsers
    ? `  --delete-users: delete ${userDocs.length} player user docs and ${authPlayers.length} player Auth accounts`
    : `  Reset counters on ${userDocs.length} player user docs (points, spent, favourites, streaks, …)`,
);
console.log(`  Clear leaderboard/students (${boardRows} rows)`);
if (!yes) {
  console.log("Dry run — nothing written. Run again with --yes to do it.");
  process.exit(0);
}

// --- Do it.
const config = (await db.collection(COL.config).doc(DOC.gameConfig).get()).data() as GameConfigDoc | undefined;
const favoriteChanges = config?.rules?.favoriteChanges ?? DEFAULT_RULES.favoriteChanges;
/** A fresh player, as completeProfile makes one (name, email, profile, createdAt and `disabled` stay). */
const RESET: Partial<Record<keyof UserDoc, unknown>> = {
  points: 0,
  spent: 0,
  wins: 0,
  losses: 0,
  totalAnswerMs: 0,
  pointsReachedAt: null,
  favMaxCount: 0,
  favorites: [],
  favoriteChangesLeft: favoriteChanges,
  dayStreak: 0,
  lastPlayDate: null,
  lingosCaught: 0,
  allTenBonus: false,
  attemptsToday: 0,
  attemptsDate: null,
  triedToday: [],
  triesToday: {},
  triedDate: null,
  wordsToday: [],
  wordsDate: null,
  seenQ: [],
  openAttemptId: null,
  flags: 0,
  suspect: false,
  voiceWins: 0,
  voicePerfectFast: 0,
  voiceSuspect: false,
  locationJumps: 0,
  lastFix: FieldValue.delete(),
};

const writer = db.bulkWriter();
const del = (refs: DocumentReference[]) => refs.forEach((r) => void writer.delete(r));
del([...catches, ...attempts, ...raidPlayers, ...redemptions, ...pointsLog, ...limits]);
if (deleteUsers) del(userDocs.map((d) => d.ref));
else for (const d of userDocs) void writer.update(d.ref, RESET);
void writer.set(board, { top: [], updatedAt: Timestamp.now() });
await writer.close();

// Each raid's joined counter = the raid players left (staff), on shard 0.
const raids = await db.collection(COL.raids).get();
for (const raid of raids.docs) {
  const left = (await raid.ref.collection(COL.players).count().get()).data().count;
  const batch = db.batch();
  for (let i = 0; i < RAID_SHARDS; i++) batch.set(raid.ref.collection(COL.shards).doc(String(i)), { count: i === 0 ? left : 0 });
  await batch.commit();
}

if (deleteUsers && authPlayers.length) {
  for (let i = 0; i < authPlayers.length; i += 1000) {
    const res = await auth.deleteUsers(authPlayers.slice(i, i + 1000).map((u) => u.uid));
    if (res.failureCount) console.warn(`  ${res.failureCount} Auth accounts could not be deleted: ${res.errors.slice(0, 3).map((e) => e.error.message).join("; ")}`);
  }
}
console.log(`Done — ${deleteUsers ? "players deleted" : "players reset to 0"}, staff kept, leaderboard cleared, ${raids.size} raid counters recounted.`);
