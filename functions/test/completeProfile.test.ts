// Calls the deployed-to-emulator completeProfile through the client SDK, like the phone does.
// Needs Auth + Firestore + Functions emulators: `npm run test:emu`.
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const apps: FirebaseApp[] = [];

async function newPlayer() {
  const app = initializeApp({ projectId: "demo-decade-hunt", apiKey: "demo-key" }, `p${apps.length}-${Date.now()}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const fns = getFunctions(app, "asia-south1");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8085);
  const email = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`;
  await createUserWithEmailAndPassword(auth, email, "password123");
  return { auth, db, completeProfile: httpsCallable(fns, "completeProfile") };
}

const roll = `T${Date.now().toString(36).toUpperCase()}`;
const profile = (r = roll) => ({ name: "Test Player", dept: "CSE", year: 1, roll: r });

let a: Awaited<ReturnType<typeof newPlayer>>;
let b: Awaited<ReturnType<typeof newPlayer>>;

beforeAll(async () => {
  [a, b] = await Promise.all([newPlayer(), newPlayer()]);
});
afterAll(async () => {
  await Promise.all(apps.map((app) => deleteApp(app)));
});

describe("completeProfile", () => {
  it("creates the profile with SPEC §4 defaults", async () => {
    await expect(a.completeProfile(profile())).resolves.toMatchObject({ data: { ok: true } });
    const snap = await getDoc(doc(a.db, "users", a.auth.currentUser!.uid));
    expect(snap.data()).toMatchObject({
      name: "Test Player",
      dept: "CSE",
      year: 1,
      roll,
      points: 0,
      attemptsToday: 0,
      attemptsDate: null,
      dayStreak: 0,
      lastPlayDate: null,
      lingosCaught: 0,
      allTenBonus: false,
      favorites: [],
      favoriteChangesLeft: 1,
      profileDone: true,
    });
    for (const old of ["todayPoints", "todayDate", "streak", "lastWinDate"]) expect(snap.data()).not.toHaveProperty(old);
  });

  it("rejects a second call by the same user", async () => {
    await expect(a.completeProfile(profile(`${roll}X`))).rejects.toMatchObject({
      code: "functions/already-exists",
      details: { code: "profile-done" },
    });
  });

  it("rejects a duplicate roll (case/space-insensitive) from another user", async () => {
    await expect(b.completeProfile(profile(`  ${roll.toLowerCase()} `))).rejects.toMatchObject({
      code: "functions/already-exists",
      details: { code: "roll-taken" },
    });
  });

  it("rejects invalid input", async () => {
    await expect(b.completeProfile({ ...profile("ZZ999"), dept: "Law" })).rejects.toMatchObject({
      code: "functions/invalid-argument",
    });
  });

  it("rejects signed-out callers", async () => {
    await signOut(b.auth);
    await expect(b.completeProfile(profile("ZZ998"))).rejects.toMatchObject({ code: "functions/unauthenticated" });
  });
});
