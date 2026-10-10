// Shared helpers for emulator tests: real client-SDK players + an admin handle for server-only data.
import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as adminFirestore, Timestamp } from "firebase-admin/firestore";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
export const PROJECT = "demo-decade-hunt";
export const FUNCTIONS_ORIGIN = `http://127.0.0.1:5001/${PROJECT}/asia-south1`;

const admin = initAdmin({ projectId: PROJECT }, `admin-${Math.random().toString(36).slice(2)}`);
export const adb = adminFirestore(admin);
export const adminAuth = getAdminAuth(admin);

export const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
/** At the seeded JECRC Foundation campus (scripts/campuses.ts). */
export const CAMPUS = { lat: 26.7838, lng: 75.8301 };

const apps: FirebaseApp[] = [];
let n = 0;

/**
 * App Check (anti-cheat D) is enforced on the emulator too. The emulator decodes App Check tokens
 * without a signature, so tests send this unsigned debug token — the same one the web app uses
 * locally (web/src/lib/firebase.ts). (The App Check JS SDK doesn't run in Node.)
 */
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
export const APP_CHECK_TOKEN = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "demo-app", iss: "emulator", exp: 4102444800 })}.emulator`;

/** Same shape as the client SDK's FunctionsError: code "functions/<status>", message, details. */
export class CallError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Calls a callable over HTTP like the client SDK (+ the App Check header unless `appCheck: false`). */
export async function callRaw<O = unknown>(name: string, data: unknown, idToken?: string | null, opts: { appCheck?: string | false } = {}): Promise<O> {
  const appCheck = opts.appCheck === undefined ? APP_CHECK_TOKEN : opts.appCheck;
  const res = await fetch(`${FUNCTIONS_ORIGIN}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...(appCheck ? { "X-Firebase-AppCheck": appCheck } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = (await res.json().catch(() => ({}))) as { result?: O; error?: { status?: string; message?: string; details?: unknown } };
  if (res.ok && !body.error) return body.result as O;
  const status = (body.error?.status ?? "INTERNAL").toLowerCase().replace(/_/g, "-");
  throw new CallError(`functions/${status}`, body.error?.message ?? res.statusText, body.error?.details);
}

/**
 * A signed-up player. `verified` marks the email verified (like clicking the link) and refreshes the
 * token; `profile` also runs completeProfile.
 */
export async function newPlayer({ profile = true, verified = true }: { profile?: boolean; verified?: boolean } = {}) {
  const app = initializeApp({ projectId: PROJECT, apiKey: "demo-key" }, `p-${Date.now()}-${n++}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const cred = await createUserWithEmailAndPassword(auth, `t${Date.now()}${n}${Math.random().toString(36).slice(2, 6)}@example.com`, "password123");
  const uid = cred.user.uid;
  const call =
    <I, O = unknown>(name: string) =>
    async (data: I) =>
      callRaw<O>(name, await humanPaced(uid, name, data), auth.currentUser ? await auth.currentUser.getIdToken() : null);
  if (verified) {
    await adminAuth.updateUser(cred.user.uid, { emailVerified: true });
    await cred.user.getIdToken(true); // new token carries email_verified
  }
  if (profile) await call("completeProfile")({ name: "Test Player" });
  return { uid: cred.user.uid, auth, call, idToken: () => cred.user.getIdToken() };
}

/**
 * Suites written before anti-cheat B/C speak "test language", translated here (security.test.ts
 * calls the server directly, untranslated, to test both rules themselves):
 *  - submitAttempt `choice` = the STORED option index (0 = right for the samples) → mapped to the
 *    position this attempt showed it at (options are shuffled per attempt);
 *  - startAttempt right after another start = "a tab left behind": the previous open attempt is
 *    backdated past the 5-second "two tabs at the same moment" guard first.
 */
async function humanPaced<I>(uid: string, name: string, data: I): Promise<I> {
  const d = data as Record<string, unknown> | undefined;
  if (name === "submitAttempt" && typeof d?.attemptId === "string" && /^[\w-]{1,64}$/.test(d.attemptId) && Number.isInteger(d.choice) && (d.choice as number) >= 0 && (d.choice as number) <= 3) {
    const order = (await adb.doc(`attempts/${d.attemptId}`).get()).data()?.order as number[] | undefined;
    if (order) return { ...d, choice: order.indexOf(d.choice as number) } as I;
  }
  if (name === "startAttempt") {
    const openId = (await adb.doc(`users/${uid}`).get()).data()?.openAttemptId as string | undefined;
    if (openId) {
      const ref = adb.doc(`attempts/${openId}`);
      const a = (await ref.get()).data();
      if (a?.status === "open" && Date.now() - a.startedAt.toMillis() < 60_000) {
        await ref.update({ startedAt: Timestamp.fromMillis(a.startedAt.toMillis() - 60_000) });
      }
    }
  }
  return data;
}

export async function cleanupApps() {
  await Promise.all(apps.map((a) => deleteApp(a)));
  await deleteAdminApp(admin);
}

/** Temporarily patch config/game; returns a restore function. */
export async function patchConfig(patch: Record<string, unknown>) {
  const ref = adb.doc("config/game");
  const before = (await ref.get()).data()!;
  await ref.update(patch);
  return () => ref.set(before);
}

// ---------- Questions (SPEC §9) ----------
// Normal tries pick from the question pool. Most suites need a known question per Lingo, so they
// pin one (emulator-only `_emulator/pins`, like `_emulator/clock`) — the samples the old fixed
// challenges used. Pins last 30 minutes, then the emulator falls back to the real pool.
type Pin = Record<string, unknown>;
export const SAMPLE: Record<"pronounce" | "speak" | "meaning" | "question", Pin> = {
  pronounce: { type: "pronounce", word: "programme", accept: ["program"] },
  speak: { type: "speak", phrase: "Practice every day and you will see the difference." },
  meaning: { type: "meaning", word: "reluctant", options: ["unwilling", "excited", "tired", "careful"], correctIndex: 0 },
  question: { type: "question", prompt: "She has been working here ___ 2022.", options: ["since", "for", "from", "at"], correctIndex: 0 },
};
const ORDER = ["pronounce", "speak", "meaning", "question"] as const;
/** lingo-2016 pronounce, 2017 speak, 2018 meaning, 2019 question, then repeating. */
export const DEFAULT_PINS: Record<string, Pin> = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [`lingo-${2016 + i}`, SAMPLE[ORDER[i % 4]]]),
);
export const pinQuestions = (byLingo: Record<string, Pin> = DEFAULT_PINS) =>
  adb.doc("_emulator/pins").set({ until: Date.now() + 30 * 60_000, byLingo });
export const unpinQuestions = () => adb.doc("_emulator/pins").delete();
/** Replace the question pool (tests) and make the functions drop their cached copy. */
export async function setQuestionPool(questions: Array<Record<string, unknown> & { id: string }>) {
  const old = await adb.collection("questions").select().get();
  const batch = adb.batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  for (const { id, ...doc } of questions) batch.set(adb.doc(`questions/${id}`), doc);
  batch.set(adb.doc("_emulator/questions"), { version: `${Date.now()}-${Math.random()}` });
  await batch.commit();
}

// Every suite starts with the default pins (re-run per test file).
await pinQuestions();
