// Load check (emulator only): an Owl Raid join burst — N players join one raid, spread over S seconds.
//   npx tsx scripts/loadRaid.ts [players=300] [spreadSeconds=10] [minPlayers=200]
// Reports errors by type, latency (p50 / p95 / slowest), the sharded joined count (must equal N) and
// whether the raid unlocked. Like loadTest.ts, the emulator runs everything in ONE local process.
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { COL, raidChallengeId, type ChallengeDoc } from "../shared/types";

const PROJECT = "demo-decade-hunt";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const FN = `http://127.0.0.1:5001/${PROJECT}/asia-south1`;
const CAMPUS = { lat: 26.7838, lng: 75.8301 };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const APP_CHECK_TOKEN = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "demo-app", iss: "emulator", exp: 4102444800 })}.emulator`;

const players = Number(process.argv[2] ?? 300);
const spreadMs = Number(process.argv[3] ?? 10) * 1000;
const minPlayers = Number(process.argv[4] ?? 200);
const run = `raid${Date.now().toString(36)}`;

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
initializeApp({ projectId: PROJECT });
const db = getFirestore();

async function post(url: string, body: unknown, token?: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Firebase-AppCheck": APP_CHECK_TOKEN, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || json.error) throw new Error(json.error?.details?.code ?? json.error?.status ?? `HTTP ${res.status}`);
  return json;
}

async function makePlayer(i: number): Promise<string> {
  const email = `${run}-${i}@load.test`;
  const su = await post(`${AUTH}/accounts:signUp?key=demo-key`, { email, password: "secret123", returnSecureToken: true });
  await post(`${AUTH}/projects/${PROJECT}/accounts:update`, { localId: su.localId, emailVerified: true }, "owner");
  const si = await post(`${AUTH}/accounts:signInWithPassword?key=demo-key`, { email, password: "secret123", returnSecureToken: true });
  await post(`${FN}/completeProfile`, { data: { name: `Raider ${i}` } }, si.idToken);
  return si.idToken;
}

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

// One live raid on poster 5 (others ended so the poster is free).
const open = await db.collection(COL.raids).where("status", "in", ["scheduled", "active"]).get();
await Promise.all(open.docs.map((d) => d.ref.update({ status: "ended" })));
const raidRef = db.collection(COL.raids).doc();
const now = Date.now();
await raidRef.set({ posterIndex: 4, lingoId: "lingo-2020", startAt: Timestamp.fromMillis(now - 1000), endAt: Timestamp.fromMillis(now + 15 * 60_000), minPlayers, unlocked: false, status: "active" });
const challenge: ChallengeDoc = { type: "meaning", word: "celebrate", options: ["to mark a happy event", "to forget", "to hide", "to leave"], correctIndex: 0 };
await db.collection(COL.challenges).doc(raidChallengeId(raidRef.id)).set(challenge);

console.log(`Creating ${players} players…`);
const t0 = Date.now();
const tokens = await pool(Array.from({ length: players }, (_, i) => i), 25, makePlayer);
console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(1)} s. Now ${players} joinRaid calls spread over ${spreadMs / 1000} s…`);

const ms: number[] = [];
const errors = new Map<string, number>();
let unlockedAt: number | null = null;
const wall = Date.now();
await Promise.all(
  tokens.map(async (token, i) => {
    await new Promise((r) => setTimeout(r, (spreadMs * i) / players));
    const s = Date.now();
    try {
      const out = await post(`${FN}/joinRaid`, { data: { raidId: raidRef.id, ...CAMPUS } }, token);
      ms.push(Date.now() - s);
      if (out.result?.unlocked && unlockedAt === null) unlockedAt = Date.now() - wall;
    } catch (e) {
      errors.set((e as Error).message, (errors.get((e as Error).message) ?? 0) + 1);
    }
  }),
);
ms.sort((a, b) => a - b);
const pct = (p: number) => ms[Math.min(ms.length - 1, Math.floor((p / 100) * ms.length))] ?? 0;
const shards = await raidRef.collection(COL.shards).get();
const joined = shards.docs.reduce((s, d) => s + (d.data().count ?? 0), 0);
const raid = (await raidRef.get()).data()!;
console.log(`All done in ${((Date.now() - wall) / 1000).toFixed(1)} s wall time.`);
console.log(
  `joinRaid  ok ${ms.length}  p50 ${pct(50)} ms  p95 ${pct(95)} ms  slowest ${ms.at(-1) ?? 0} ms  errors: ${[...errors].map(([k, v]) => `${k}×${v}`).join(", ") || "none"}`,
);
console.log(`joined (shards sum) ${joined}/${players}; unlocked ${raid.unlocked} (min ${minPlayers}${unlockedAt !== null ? `, first seen at ${(unlockedAt / 1000).toFixed(1)} s` : ""})`);
await raidRef.update({ status: "ended" });
process.exit(0);
