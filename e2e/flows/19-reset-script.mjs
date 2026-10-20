// 19. scripts/resetForEvent.ts on the emulator — in its OWN project (demo-reset-test), so the game's
//     emulator data (other flows, laptop test accounts) is never touched. Plants 2 players, an admin and
//     a volunteer with game data everywhere, then: the dry run prints counts and writes nothing;
//     --yes deletes the players' catches / attempts / raid players / redemptions / pointsLog / limits,
//     resets their counters, clears the leaderboard, keeps staff (roles + data) and recounts raids;
//     --delete-users also removes the players' Auth accounts and user docs.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ok, Timestamp } from "../lib.mjs"; // (lib.mjs also points the Admin SDK at the emulators)

const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT = "demo-reset-test";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const app = initializeApp({ projectId: PROJECT }, "reset-test");
const db = getFirestore(app);
const auth = getAuth(app);

async function wipe() {
  for (const c of ["users", "attempts", "redemptions", "pointsLog", "limits", "raids", "leaderboard", "config"]) await db.recursiveDelete(db.collection(c));
  const { users } = await auth.listUsers(1000);
  if (users.length) await auth.deleteUsers(users.map((u) => u.uid));
}
const run = (...extra) =>
  execFileSync("npx", ["tsx", "scripts/resetForEvent.ts", "--project", PROJECT, ...extra], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" },
  });

/** An account with game data in every place the reset touches. */
async function plant(name, role) {
  const u = await auth.createUser({ email: `${name.toLowerCase()}@reset.test`, password: "test1234", emailVerified: true });
  if (role) await auth.setCustomUserClaims(u.uid, { role });
  const uid = u.uid;
  await db.doc(`users/${uid}`).set({
    name,
    email: `${name.toLowerCase()}@reset.test`,
    profileDone: true,
    createdAt: Timestamp.now(),
    points: 4321,
    spent: 300,
    wins: 9,
    losses: 2,
    totalAnswerMs: 36000,
    pointsReachedAt: Timestamp.now(),
    favMaxCount: 2,
    favorites: ["lingo-2016", "lingo-2017"],
    favoriteChangesLeft: 0,
    dayStreak: 3,
    lastPlayDate: "2026-10-22#R3",
    lingosCaught: 4,
    allTenBonus: false,
    attemptsToday: 3,
    attemptsDate: "2026-10-22#R3",
    triedToday: ["lingo-2016"],
    triesToday: { "lingo-2016": 1 },
    triedDate: "2026-10-22#R3",
    wordsToday: ["since"],
    wordsDate: "2026-10-22#R3",
    seenQ: ["q1", "q2"],
    openAttemptId: null,
    flags: 3,
    suspect: true,
    voiceWins: 2,
    voicePerfectFast: 1,
    voiceSuspect: false,
    locationJumps: 1,
    lastFix: { lat: 26.78, lng: 75.83, at: Timestamp.now() },
    disabled: name === "Paused",
  });
  await db.doc(`users/${uid}/catches/lingo-2016`).set({ level: "MAX", timesCaught: 3, favStreak: 3, lastCaughtDate: "2026-10-22#R3", firstCaughtAt: Timestamp.now(), maxBonusGiven: true });
  await db.collection("attempts").add({ uid, lingoId: "lingo-2016", status: "won" });
  await db.collection("redemptions").add({ uid, prizeId: "tshirt", cost: 300, byUid: "desk" });
  await db.collection("pointsLog").add({ uid, amount: 100, reason: "firstCatch" });
  await db.doc(`limits/${uid}`).set({ minute: 1, calls: 3, starts: 1 });
  await db.doc(`raids/raid-1/players/${uid}`).set({ joinedAt: Timestamp.now() });
  return uid;
}

await wipe();
try {
  await db.doc("config/game").set({ rules: { favoriteChanges: 0 } });
  const p1 = await plant("Player", null);
  const p2 = await plant("Paused", null);
  const admin = await plant("Admin", "admin");
  const vol = await plant("Volunteer", "volunteer");
  await db.doc("raids/raid-1").set({ lingoId: "lingo-2016", status: "active" });
  for (let i = 0; i < 10; i++) await db.doc(`raids/raid-1/shards/${i}`).set({ count: i < 4 ? 1 : 0 });
  await db.doc("leaderboard/students").set({ top: [{ uid: p1, name: "Player", points: 4321 }], updatedAt: Timestamp.now() });

  // --- Dry run: counts, nothing written.
  const dry = run();
  ok(/DRY RUN/.test(dry) && /Staff kept: 2 \(1 admin, 1 volunteer\)/.test(dry), "dry run: says so, counts the staff");
  ok(/Players: 2 user docs, 2 Auth accounts/.test(dry) && /Delete: 2 catches, 2 attempts, 2 raid players, 2 redemptions, 2 pointsLog, 2 rate-limit docs/.test(dry), `dry run: counts (${dry.split("\n")[3]?.trim()})`);
  ok(/Clear leaderboard\/students \(1 rows\)/.test(dry), "dry run: the leaderboard rows");
  ok((await db.doc(`users/${p1}`).get()).data().points === 4321 && (await db.collection("attempts").get()).size === 4, "dry run: nothing written");

  // --- --yes: players reset, staff kept.
  const out = run("--yes");
  ok(/Done — players reset to 0/.test(out), "--yes: done");
  for (const [uid, label] of [[p1, "player"], [p2, "paused player"]]) {
    const u = (await db.doc(`users/${uid}`).get()).data();
    const zero = u.points === 0 && u.spent === 0 && u.wins === 0 && u.losses === 0 && u.totalAnswerMs === 0 && u.favMaxCount === 0 && u.dayStreak === 0 && u.lingosCaught === 0 && u.flags === 0 && u.suspect === false && u.locationJumps === 0;
    const cleared = u.favorites.length === 0 && u.favoriteChangesLeft === 0 && u.pointsReachedAt === null && u.lastPlayDate === null && u.attemptsToday === 0 && u.attemptsDate === null && u.triedDate === null && u.triedToday.length === 0 && Object.keys(u.triesToday).length === 0 && u.wordsDate === null && u.seenQ.length === 0 && u.lastFix === undefined;
    ok(zero && cleared && u.name && u.profileDone === true, `--yes: ${label} counters reset, profile kept`);
  }
  ok((await db.doc(`users/${p2}`).get()).data().disabled === true, "--yes: a paused player stays paused");
  for (const uid of [p1, p2]) {
    const left = await Promise.all([
      db.collection(`users/${uid}/catches`).get().then((s) => s.size),
      db.collection("attempts").where("uid", "==", uid).get().then((s) => s.size),
      db.collection("redemptions").where("uid", "==", uid).get().then((s) => s.size),
      db.collection("pointsLog").where("uid", "==", uid).get().then((s) => s.size),
      db.doc(`limits/${uid}`).get().then((s) => +s.exists),
      db.doc(`raids/raid-1/players/${uid}`).get().then((s) => +s.exists),
    ]);
    ok(left.every((n) => n === 0), `--yes: the player's catches, attempts, redemptions, pointsLog, limits, raid entry gone (${left})`);
  }
  for (const [uid, role] of [[admin, "admin"], [vol, "volunteer"]]) {
    const u = (await db.doc(`users/${uid}`).get()).data();
    const kept = [
      u.points === 4321,
      (await db.collection(`users/${uid}/catches`).get()).size === 1,
      (await db.collection("attempts").where("uid", "==", uid).get()).size === 1,
      (await db.doc(`raids/raid-1/players/${uid}`).get()).exists,
      (await auth.getUser(uid)).customClaims?.role === role,
    ];
    ok(kept.every(Boolean), `--yes: ${role} kept (data + role) (${kept})`);
  }
  const board = (await db.doc("leaderboard/students").get()).data();
  ok(board.top.length === 0, "--yes: leaderboard cleared");
  const shards = (await db.collection("raids/raid-1/shards").get()).docs.reduce((a, d) => a + d.data().count, 0);
  ok(shards === 2, `--yes: the raid's joined counter = the staff left (${shards})`);
  ok((await auth.getUser(p1).catch(() => null)) !== null, "--yes (no --delete-users): Auth accounts kept");

  // --- --delete-users: the players' Auth accounts and user docs go too.
  const del = run("--yes", "--delete-users");
  ok(/players deleted/.test(del), "--delete-users: done");
  ok(!(await db.doc(`users/${p1}`).get()).exists && !(await db.doc(`users/${p2}`).get()).exists, "--delete-users: player user docs deleted");
  ok((await auth.getUser(p1).catch(() => null)) === null && (await auth.getUser(p2).catch(() => null)) === null, "--delete-users: player Auth accounts deleted");
  ok((await db.doc(`users/${admin}`).get()).exists && (await auth.getUser(vol)).customClaims?.role === "volunteer", "--delete-users: staff kept");

  // Refuses production without a real project.
  let refused = false;
  try {
    execFileSync("npx", ["tsx", "scripts/resetForEvent.ts", "--prod"], { cwd: ROOT, shell: true, stdio: "pipe" });
  } catch {
    refused = true;
  }
  ok(refused, "--prod without --project <real id> is refused");
} finally {
  await wipe();
}
