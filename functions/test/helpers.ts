// Shared helpers for emulator tests: real client-SDK players + an admin handle for server-only data.
import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
export const PROJECT = "demo-decade-hunt";
export const FUNCTIONS_ORIGIN = `http://127.0.0.1:5001/${PROJECT}/asia-south1`;

const admin = initAdmin({ projectId: PROJECT }, `admin-${Math.random().toString(36).slice(2)}`);
export const adb = adminFirestore(admin);
export const adminAuth = getAdminAuth(admin);

export const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
/** Inside the seeded (huge) campus radius. */
export const CAMPUS = { lat: 26.7838, lng: 75.8225 };

const apps: FirebaseApp[] = [];
let n = 0;

/**
 * A signed-up player. `verified` marks the email verified (like clicking the link) and refreshes the
 * token; `profile` also runs completeProfile.
 */
export async function newPlayer({ profile = true, verified = true }: { profile?: boolean; verified?: boolean } = {}) {
  const app = initializeApp({ projectId: PROJECT, apiKey: "demo-key" }, `p-${Date.now()}-${n++}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const fns = getFunctions(app, "asia-south1");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const cred = await createUserWithEmailAndPassword(auth, `t${Date.now()}${n}${Math.random().toString(36).slice(2, 6)}@example.com`, "password123");
  const call = <I, O = unknown>(name: string) => async (data: I) => (await httpsCallable<I, O>(fns, name)(data)).data;
  if (verified) {
    await adminAuth.updateUser(cred.user.uid, { emailVerified: true });
    await cred.user.getIdToken(true); // new token carries email_verified
  }
  if (profile) await call("completeProfile")({ name: "Test Player" });
  return { uid: cred.user.uid, auth, call, idToken: () => cred.user.getIdToken() };
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
