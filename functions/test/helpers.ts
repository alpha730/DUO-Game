// Shared helpers for emulator tests: real client-SDK players + an admin handle for server-only data.
import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from "firebase-admin/app";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
export const PROJECT = "demo-decade-hunt";
export const FUNCTIONS_ORIGIN = `http://127.0.0.1:5001/${PROJECT}/asia-south1`;

const admin = initAdmin({ projectId: PROJECT }, `admin-${Math.random().toString(36).slice(2)}`);
export const adb = adminFirestore(admin);

export const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
/** Inside the seeded (huge) campus radius. */
export const CAMPUS = { lat: 26.7838, lng: 75.8225 };

const apps: FirebaseApp[] = [];
let n = 0;

export async function newPlayer({ profile = true }: { profile?: boolean } = {}) {
  const app = initializeApp({ projectId: PROJECT, apiKey: "demo-key" }, `p-${Date.now()}-${n++}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const fns = getFunctions(app, "asia-south1");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const cred = await createUserWithEmailAndPassword(auth, `t${Date.now()}${n}${Math.random().toString(36).slice(2, 6)}@example.com`, "password123");
  const call = <I, O = unknown>(name: string) => async (data: I) => (await httpsCallable<I, O>(fns, name)(data)).data;
  if (profile) {
    await call("completeProfile")({ name: "Test Player", dept: "CSE", year: 2, roll: `T${Date.now().toString(36)}${n}`.toUpperCase() });
  }
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
