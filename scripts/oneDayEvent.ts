// Turns the game into the ONE-DAY EVENT (Oct 22): 3 rounds, per-round tries and streaks, 3 levels
// (Lv 1 → Lv 2 → MAX), 2 favourites with no swaps, favourites to MAX rank right after points.
// Writes config/game: rounds, startAt (= round 1 start), lockAt (= last round end), locked = false and
// rules = current rules + ONE_DAY_RULES (shared/types.ts); and public/event = { date, rounds }, which
// anyone can read (the login screen + Rules show the times before sign-in). Nothing else is touched.
//   Emulator (default):  npx tsx scripts/oneDayEvent.ts
//   Production:          GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/oneDayEvent.ts --prod --project <id>
//   Options:             --date 2026-10-22   --rounds 11:30-12:30,13:00-14:00,14:30-15:30   --dry-run
//   Turn it off:         --off  removes `rounds` from config/game and deletes public/event (back to the
//                        multi-day game; times, lock and rules are left as they are)
// Times are IST. Re-run it to change the times.
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { COL, DEFAULT_RULES, DOC, ONE_DAY_RULES, type GameConfigDoc, type PublicEventDoc } from "../shared/types";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const prod = args.includes("--prod");
const dry = args.includes("--dry-run");
const projectId = opt("project", "demo-decade-hunt");
const date = opt("date", "2026-10-22");
const spec = opt("rounds", "11:30-12:30,13:00-14:00,14:30-15:30");
if (!prod) process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
if (prod && projectId.startsWith("demo-")) throw new Error("--prod needs --project <real project id>");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("--date must be YYYY-MM-DD");

if (args.includes("--off")) {
  initializeApp({ projectId });
  const fs = getFirestore();
  const cfg = fs.collection(COL.config).doc(DOC.gameConfig);
  const pub = fs.collection(COL.public).doc(DOC.publicEvent);
  const [c, p] = await Promise.all([cfg.get(), pub.get()]);
  const n = ((c.data() as GameConfigDoc | undefined)?.rounds ?? []).length;
  console.log(`${prod ? projectId : "Emulator"} — one-day event OFF: remove ${n} rounds from config/game, ${p.exists ? "delete" : "no"} public/event.`);
  if (dry) {
    console.log("Dry run — nothing written.");
    process.exit(0);
  }
  if (c.exists) await cfg.update({ rounds: FieldValue.delete() });
  await pub.delete();
  console.log("Done — back to the multi-day game (times, lock and rules unchanged).");
  process.exit(0);
}

const ist = (hhmm: string) => {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) throw new Error(`Bad time "${hhmm}" (use HH:MM, IST).`);
  return Date.parse(`${date}T${hhmm.padStart(5, "0")}:00+05:30`);
};
const rounds = spec.split(",").map((r) => {
  const [a, b] = r.split("-");
  return { startAt: ist(a), endAt: ist(b) };
});
if (rounds.length < 1 || rounds.length > 5) throw new Error("Give 1–5 rounds.");
rounds.forEach((r, i) => {
  if (!(r.startAt < r.endAt)) throw new Error(`Round ${i + 1} ends before it starts.`);
  if (i > 0 && r.startAt < rounds[i - 1].endAt) throw new Error(`Round ${i + 1} overlaps round ${i}.`);
});

initializeApp({ projectId });
const db = getFirestore();
const ref = db.collection(COL.config).doc(DOC.gameConfig);
const current = (await ref.get()).data() as GameConfigDoc | undefined;
if (!current) throw new Error("config/game doesn't exist — run scripts/seed.ts first.");

const rules = { ...DEFAULT_RULES, ...current.rules, ...ONE_DAY_RULES };
const fmt = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(11, 16);
console.log(`${prod ? projectId : "Emulator"} — one-day event on ${date} (IST):`);
rounds.forEach((r, i) => console.log(`  Round ${i + 1}: ${fmt(r.startAt)}–${fmt(r.endAt)}`));
console.log(`  Game opens ${fmt(rounds[0].startAt)}, locks ${fmt(rounds.at(-1)!.endAt)}.`);
console.log(`  Rules: ${Object.entries(ONE_DAY_RULES).map(([k, v]) => `${k}=${v}`).join(", ")}`);
if (dry) {
  console.log("Dry run — nothing written.");
  process.exit(0);
}
const roundDocs = rounds.map((r) => ({ startAt: Timestamp.fromMillis(r.startAt), endAt: Timestamp.fromMillis(r.endAt) }));
const publicEvent: Omit<PublicEventDoc, "rounds"> & { rounds: typeof roundDocs } = { date, rounds: roundDocs };
await db.collection(COL.public).doc(DOC.publicEvent).set(publicEvent);
await ref.update({
  rounds: roundDocs,
  startAt: Timestamp.fromMillis(rounds[0].startAt),
  lockAt: Timestamp.fromMillis(rounds.at(-1)!.endAt),
  locked: false,
  rules,
});
console.log("Written (config/game + public/event) — the game uses it straight away.");
