// Day 8 load check (emulator only): N players do startAttempt → submitAttempt at the same moment.
//   npx tsx scripts/loadTest.ts [players=500] [spreadSeconds=0] [lingoId=lingo-2018] [choice=0]
// spreadSeconds = 0: everyone at the same instant; e.g. 30: arrivals spread evenly over 30 s.
// Reports errors by type and latency (p50 / p95 / slowest). The emulator runs every call in ONE
// local process, so it is a stress test of our code and transactions, not of Cloud Functions scaling
// (production starts more instances automatically).
const PROJECT = "demo-decade-hunt";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const FN = `http://127.0.0.1:5001/${PROJECT}/asia-south1`;
const CAMPUS = { lat: 26.7838, lng: 75.8225 };

const players = Number(process.argv[2] ?? 500);
const spreadMs = Number(process.argv[3] ?? 0) * 1000;
const lingoId = process.argv[4] ?? "lingo-2018";
const choice = Number(process.argv[5] ?? 0);
const run = `load${Date.now().toString(36)}`;

async function post(url: string, body: unknown, token?: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }).catch((e: Error & { cause?: { code?: string } }) => {
    throw new Error(`network ${e.cause?.code ?? e.message}`);
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || json.error) throw new Error(json.error?.details?.code ?? json.error?.status ?? json.error?.message ?? `HTTP ${res.status}`);
  return json;
}
const call = (name: string, data: unknown, token: string) => post(`${FN}/${name}`, { data }, token).then((j) => j.result);

/** Runs `fn` over `items` with at most `limit` in flight. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function makePlayer(i: number): Promise<string> {
  const email = `${run}-${i}@load.test`;
  const su = await post(`${AUTH}/accounts:signUp?key=demo-key`, { email, password: "secret123", returnSecureToken: true });
  await post(`${AUTH}/projects/${PROJECT}/accounts:update`, { localId: su.localId, emailVerified: true }, "owner");
  const si = await post(`${AUTH}/accounts:signInWithPassword?key=demo-key`, { email, password: "secret123", returnSecureToken: true });
  await call("completeProfile", { name: `Load ${i}` }, si.idToken);
  return si.idToken as string;
}

const pct = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];
function report(name: string, ms: number[], errors: Map<string, number>) {
  const s = [...ms].sort((a, b) => a - b);
  const errs = [...errors].map(([k, v]) => `${k}×${v}`).join(", ") || "none";
  console.log(
    `${name.padEnd(14)} ok ${String(s.length).padStart(4)}  p50 ${pct(s, 50) ?? "-"} ms  p95 ${pct(s, 95) ?? "-"} ms  slowest ${s.at(-1) ?? "-"} ms  errors: ${errs}`,
  );
}

console.log(`Creating ${players} players…`);
const t0 = Date.now();
const tokens = await pool(Array.from({ length: players }, (_, i) => i), 25, makePlayer);
console.log(
  `  done in ${((Date.now() - t0) / 1000).toFixed(1)} s. Now ${players} start + answer ${spreadMs ? `spread over ${spreadMs / 1000} s` : "at once"}…`,
);

const startMs: number[] = [];
const submitMs: number[] = [];
const startErr = new Map<string, number>();
const submitErr = new Map<string, number>();
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
let won = 0;

const wall = Date.now();
await Promise.all(
  tokens.map(async (token, i) => {
    if (spreadMs) await new Promise((r) => setTimeout(r, (i / players) * spreadMs));
    let attemptId: string;
    let t = Date.now();
    try {
      attemptId = (await call("startAttempt", { lingoId, ...CAMPUS }, token)).attemptId;
      startMs.push(Date.now() - t);
    } catch (e) {
      bump(startErr, (e as Error).message);
      return;
    }
    t = Date.now();
    try {
      const out = await call("submitAttempt", { attemptId, choice }, token);
      submitMs.push(Date.now() - t);
      if (out.result === "won") won++;
    } catch (e) {
      bump(submitErr, (e as Error).message);
    }
  }),
);
console.log(`All done in ${((Date.now() - wall) / 1000).toFixed(1)} s wall time; ${won}/${players} won.`);
report("startAttempt", startMs, startErr);
report("submitAttempt", submitMs, submitErr);
