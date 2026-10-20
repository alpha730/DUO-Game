// Turns the game into the ONE-DAY EVENT (Oct 22): 3 rounds, per-round tries and streaks, 3 levels
// (Lv 1 → Lv 2 → MAX), 2 favourites with no swaps, favourites to MAX rank right after points.
// Writes config/game: rounds, startAt (= round 1 start), lockAt (= last round end), locked = false and
// rules = current rules + ONE_DAY_RULES (shared/types.ts). Nothing else is touched.
//   Emulator (default):  npx tsx scripts/oneDayEvent.ts
//   Production:          GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/oneDayEvent.ts --prod --project <id>
//   Options:             --date 2026-10-22   --rounds 10:00-11:30,12:30-14:00,15:00-16:00   --dry-run
// Times are IST. Re-run it to change the times.
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { COL, DEFAULT_RULES, DOC, ONE_DAY_RULES, type GameConfigDoc } from "../shared/types";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const prod = args.includes("--prod");
const dry = args.includes("--dry-run");
const projectId = opt("project", "demo-decade-hunt");
const date = opt("date", "2026-10-22");
const spec = opt("rounds", "10:00-11:30,12:30-14:00,15:00-16:00");
if (!prod) process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
if (prod && projectId.startsWith("demo-")) throw new Error("--prod needs --project <real project id>");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("--date must be YYYY-MM-DD");

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
await ref.update({
  rounds: rounds.map((r) => ({ startAt: Timestamp.fromMillis(r.startAt), endAt: Timestamp.fromMillis(r.endAt) })),
  startAt: Timestamp.fromMillis(rounds[0].startAt),
  lockAt: Timestamp.fromMillis(rounds.at(-1)!.endAt),
  locked: false,
  rules,
});
console.log("Written — the game uses it straight away.");
